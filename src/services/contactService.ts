import { pool } from "../db";

export async function identifyContact(
  email?: string,
  phoneNumber?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find existing contacts matching email or phone
    const { rows } = await client.query(
      `
      SELECT * FROM Contact
      WHERE email = $1 OR phoneNumber = $2
      `,
      [email, phoneNumber]
    );

    // Case 1: No existing contact → Create primary
    if (rows.length === 0) {
      const insert = await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkPrecedence)
        VALUES ($1, $2, 'primary')
        RETURNING *
        `,
        [email, phoneNumber]
      );

      await client.query("COMMIT");

      return {
        primaryContactId: insert.rows[0].id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [],
      };
    }

    // Find oldest primary
    const primaryContacts = rows.filter(
      (c) => c.linkprecedence === "primary"
    );

    const oldestPrimary = primaryContacts.sort(
      (a, b) =>
        new Date(a.createdat).getTime() -
        new Date(b.createdat).getTime()
    )[0];

    // Convert other primaries to secondary
    for (const contact of primaryContacts) {
      if (contact.id !== oldestPrimary.id) {
        await client.query(
          `
          UPDATE Contact
          SET linkPrecedence = 'secondary',
              linkedId = $1
          WHERE id = $2
          `,
          [oldestPrimary.id, contact.id]
        );
      }
    }

    // Check if new info needs new secondary
    const emails = new Set(rows.map((r) => r.email).filter(Boolean));
    const phones = new Set(rows.map((r) => r.phonenumber).filter(Boolean));

    if (!emails.has(email) || !phones.has(phoneNumber)) {
      await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence)
        VALUES ($1, $2, $3, 'secondary')
        `,
        [email, phoneNumber, oldestPrimary.id]
      );
    }

    // Fetch final consolidated contacts
    const finalContacts = await client.query(
      `
      SELECT * FROM Contact
      WHERE id = $1 OR linkedId = $1
      `,
      [oldestPrimary.id]
    );

    await client.query("COMMIT");

    const all = finalContacts.rows;

    return {
      primaryContactId: oldestPrimary.id,
      emails: [
        oldestPrimary.email,
        ...all
          .filter((c) => c.linkprecedence === "secondary")
          .map((c) => c.email)
          .filter(Boolean),
      ],
      phoneNumbers: [
        oldestPrimary.phonenumber,
        ...all
          .filter((c) => c.linkprecedence === "secondary")
          .map((c) => c.phonenumber)
          .filter(Boolean),
      ],
      secondaryContactIds: all
        .filter((c) => c.linkprecedence === "secondary")
        .map((c) => c.id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
