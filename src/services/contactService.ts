import { pool } from "../db";

export async function identifyContact(
  email?: string,
  phoneNumber?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Find all contacts matching email OR phone
    const { rows: matched } = await client.query(
      `
      SELECT * FROM Contact
      WHERE email = $1 OR phoneNumber = $2
      `,
      [email, phoneNumber]
    );

    // 2️⃣ If no match → create new primary
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

    // 3️⃣ Collect all related IDs (primary + secondary)
    const primaryIds = new Set<number>();

    for (const contact of matched) {
      if (contact.linkprecedence === "primary") {
        primaryIds.add(contact.id);
      } else {
        primaryIds.add(contact.linkedid);
      }
    }

    // 4️⃣ Get full cluster
    const { rows: cluster } = await client.query(
      `
      SELECT * FROM Contact
      WHERE id = ANY($1) OR linkedId = ANY($1)
      `,
      [Array.from(primaryIds)]
    );

    // 5️⃣ Determine oldest primary
    const primaries = cluster.filter(
      (c) => c.linkprecedence === "primary"
    );

    const oldestPrimary = primaries.sort(
      (a, b) =>
        new Date(a.createdat).getTime() -
        new Date(b.createdat).getTime()
    )[0];

    // 6️⃣ Convert other primaries to secondary
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

    // 7️⃣ Check if new secondary needed
    const existingEmails = new Set(cluster.map(c => c.email).filter(Boolean));
    const existingPhones = new Set(cluster.map(c => c.phonenumber).filter(Boolean));

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

// ✅ Remove duplicates using Set
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

return {
  primaryContactId: oldestPrimary.id,
  emails: Array.from(emailSet),
  phoneNumbers: Array.from(phoneSet),
  secondaryContactIds: secondaryIds,
};
  }
