import { pool } from "../db";

export async function identifyContact(email?: string, phoneNumber?: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1️⃣ Find matching contacts
    const { rows } = await client.query(
      `
      SELECT * FROM Contact
      WHERE (email = $1 OR phoneNumber = $2)
      AND deletedAt IS NULL
      `,
      [email, phoneNumber]
    );

    // 🟢 CASE 1: No existing contacts
    if (rows.length === 0) {
      const result = await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkPrecedence)
        VALUES ($1, $2, 'primary')
        RETURNING *
        `,
        [email, phoneNumber]
      );

      await client.query("COMMIT");

      return {
        primaryContactId: result.rows[0].id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [],
      };
    }

    // 2️⃣ Find oldest primary
    let allContacts = rows;

    // If any secondary, fetch their primary
    for (const row of rows) {
      if (row.linkprecedence === "secondary") {
        const primary = await client.query(
          `SELECT * FROM Contact WHERE id = $1`,
          [row.linkedid]
        );
        allContacts.push(primary.rows[0]);
      }
    }

    const primary = allContacts
      .filter(c => c.linkprecedence === "primary")
      .sort((a, b) => new Date(a.createdat).getTime() - new Date(b.createdat).getTime())[0];

    // 3️⃣ Merge multiple primaries
    const otherPrimaries = allContacts.filter(
      c => c.linkprecedence === "primary" && c.id !== primary.id
    );

    for (const p of otherPrimaries) {
      await client.query(
        `
        UPDATE Contact
        SET linkPrecedence='secondary',
            linkedId=$1,
            updatedAt=CURRENT_TIMESTAMP
        WHERE id=$2
        `,
        [primary.id, p.id]
      );
    }

    // 4️⃣ Insert secondary if new info
    const emails = [...new Set(allContacts.map(c => c.email).filter(Boolean))];
    const phones = [...new Set(allContacts.map(c => c.phonenumber).filter(Boolean))];

    const emailExists = email && emails.includes(email);
    const phoneExists = phoneNumber && phones.includes(phoneNumber);

    if (!emailExists || !phoneExists) {
      const newContact = await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence)
        VALUES ($1, $2, $3, 'secondary')
        RETURNING *
        `,
        [email, phoneNumber, primary.id]
      );

      allContacts.push(newContact.rows[0]);
    }

    await client.query("COMMIT");

    const finalContacts = await client.query(
      `
      SELECT * FROM Contact
      WHERE id = $1 OR linkedId = $1
      `,
      [primary.id]
    );

    const finalRows = finalContacts.rows;

    return {
      primaryContactId: primary.id,
      emails: [
        primary.email,
        ...finalRows
          .filter(c => c.linkprecedence === "secondary")
          .map(c => c.email)
          .filter(Boolean),
      ],
      phoneNumbers: [
        primary.phonenumber,
        ...finalRows
          .filter(c => c.linkprecedence === "secondary")
          .map(c => c.phonenumber)
          .filter(Boolean),
      ],
      secondaryContactIds: finalRows
        .filter(c => c.linkprecedence === "secondary")
        .map(c => c.id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}