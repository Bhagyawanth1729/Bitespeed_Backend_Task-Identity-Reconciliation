#  Bitespeed Identity Reconciliation API

This project implements the Bitespeed Backend Task for Identity Reconciliation.

The service identifies and consolidates customer contact information across multiple purchases, even when different email addresses or phone numbers are used.

---

##  Problem Statement

Customers may place orders using different email addresses and phone numbers.

The system must:
- Identify if contacts are linked
- Maintain a primary contact (oldest)
- Convert other related contacts into secondary
- Merge multiple primaries when necessary
- Return a consolidated contact response

---

## Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Hosted on Render

---

##  Database Schema

Table: `Contact`

| Field | Type | Description |
|--------|--------|------------|
| id | Int | Primary Key |
| phoneNumber | String | Optional |
| email | String | Optional |
| linkedId | Int | References primary contact |
| linkPrecedence | "primary" \| "secondary" | Contact type |
| createdAt | DateTime | Record creation time |
| updatedAt | DateTime | Last update time |
| deletedAt | DateTime? | Soft delete |

---

## 🔗 API Endpoint

### POST `/identify`

### Request Body (JSON)

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}

#Response Format
{
  "contact": {
    "primaryContactId": number,
    "emails": ["primary_email", "secondary_email"],
    "phoneNumbers": ["primary_phone", "secondary_phone"],
    "secondaryContactIds": [number]
  }
}
