BrewSmart Database - Final Submission

Use only:
    BrewSmart_DATABASE.sql

Fresh installation:
1. Open phpMyAdmin.
2. Select Import.
3. Choose BrewSmart_DATABASE.sql.
4. Click Go.

The SQL file creates the complete BrewSmart database and includes:
- Users and role/access permissions
- Broker and Buyer masters
- Tea Auction Calendar
- Tea Grades with packing density and bag-weight ranges
- Marks and Packing Types
- Arrival Turn headers (Turn No / lorry / driver / NIC)
- Separate Broker arrival batches under the same Turn
- Mark + Invoice Number duplicate protection
- Warehouse invoices and multi-invoice turns
- GRN, GIN and Gate Pass workflow
- Stock movements and issued history
- AI allocation/recommendation tables
- 20 racks x 6 levels x 60 positions = 7,200 locations
- Maximum 10 bags per location
- Heavy-bag safety rule: 50-65 kg only on levels A/B/C
- Demonstration data for lecturer presentation

Default login:
Username: admin
Password: admin123

Important:
This final SQL is intended for a fresh project setup and recreates the BrewSmart tables.
Do not import it over a live database containing data you need to keep.

For an EXISTING BrewSmart database, do not re-import the full database file.
Use the separate compatibility patch supplied with the 2026.4 release.
