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


Behaviour Rules

-If no matching contact → create new primary
-If matching contact found → return consolidated result
-If new information provided → create secondary
-If two primaries are linked → oldest remains primary
-All linked records return under one consolidated response

#$ Example
Request
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
Response
{
  "contact": {
    "primaryContactId": 1,
    "emails": [
      "lorraine@hillvalley.edu",
      "mcfly@hillvalley.edu"
    ],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
##  Hosted Endpoint
https://bitespeed-backend-task-identity-2ztq.onrender.com/identify


##  How to Run Locally
1. Install dependencies
npm install
2. Create PostgreSQL database
CREATE DATABASE bitespeed;
3. Start development server
npm run dev

Server runs on:

http://localhost:3000
## Build for Production
npm run build
npm start


Submission
https://bitespeed-backend-task-identity-2ztq.onrender.com/identify

##Author
Bhagyawanth
Bitespeed Backend Task Submission
