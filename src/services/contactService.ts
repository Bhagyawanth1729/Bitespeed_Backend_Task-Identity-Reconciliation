import { pool } from "../db";

export async function identifyContact(
  email?: string,
  phoneNumber?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: matched } = await client.query(
      `
      SELECT * FROM Contact
      WHERE email = $1 OR phoneNumber = $2
      `,
      [email, phoneNumber]
    );

    if (matched.length === 0) {
      const { rows } = await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkPrecedence)
        VALUES ($1, $2, 'primary')
        RETURNING *
        `,
        [email, phoneNumber]
      );

      await client.query("COMMIT");

      return {
        primaryContactId: rows[0].id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [],
      };
    }

    const primaryIds = new Set<number>();

    for (const contact of matched) {
      if (contact.linkprecedence === "primary") {
        primaryIds.add(contact.id);
      } else {
        primaryIds.add(contact.linkedid);
      }
    }

    const { rows: cluster } = await client.query(
      `
      SELECT * FROM Contact
      WHERE id = ANY($1) OR linkedId = ANY($1)
      `,
      [Array.from(primaryIds)]
    );

    const primaries = cluster.filter(
      (c) => c.linkprecedence === "primary"
    );

    const oldestPrimary = primaries.sort(
      (a, b) =>
        new Date(a.createdat).getTime() -
        new Date(b.createdat).getTime()
    )[0];

    for (const primary of primaries) {
      if (primary.id !== oldestPrimary.id) {
        await client.query(
          `
          UPDATE Contact
          SET linkPrecedence = 'secondary',
              linkedId = $1
          WHERE id = $2
          `,
          [oldestPrimary.id, primary.id]
        );
      }
    }

    const existingEmails = new Set(
      cluster.map((c) => c.email).filter(Boolean)
    );

    const existingPhones = new Set(
      cluster.map((c) => c.phonenumber).filter(Boolean)
    );

    if (
      (email && !existingEmails.has(email)) ||
      (phoneNumber && !existingPhones.has(phoneNumber))
    ) {
      await client.query(
        `
        INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence)
        VALUES ($1, $2, $3, 'secondary')
        `,
        [email, phoneNumber, oldestPrimary.id]
      );
    }

    const { rows: final } = await client.query(
      `
      SELECT * FROM Contact
      WHERE id = $1 OR linkedId = $1
      `,
      [oldestPrimary.id]
    );

    await client.query("COMMIT");

    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();
    const secondaryIds: number[] = [];

    for (const contact of final) {
      if (contact.email) emailSet.add(contact.email);
      if (contact.phonenumber) phoneSet.add(contact.phonenumber);

      if (contact.linkprecedence === "secondary") {
        secondaryIds.push(contact.id);
      }
    }

    const emails = [
      oldestPrimary.email,
      ...Array.from(emailSet).filter(
        (e) => e !== oldestPrimary.email
      ),
    ];

    const phoneNumbers = [
      oldestPrimary.phonenumber,
      ...Array.from(phoneSet).filter(
        (p) => p !== oldestPrimary.phonenumber
      ),
    ];

    return {
      primaryContactId: oldestPrimary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaryIds,
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
