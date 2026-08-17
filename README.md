# 🍃 BrewSmart

## AI-Based Smart Tea Warehouse Management & Optimization System

**BrewSmart** is an intelligent tea warehouse management and optimization system designed to improve tea inventory management, warehouse location allocation, plate allocation, and operational decision-making through modern web technologies and Artificial Intelligence.

---

## 📌 Project Overview

BrewSmart is a final-year Software Engineering project developed to modernize and improve tea warehouse operations.

The system combines:

* 🏭 Warehouse Management
* 📦 Inventory Management
* 📍 Intelligent Location Allocation
* 📦 Smart Plate Allocation
* 🤖 Artificial Intelligence / Machine Learning
* 📊 Management Reports
* 🔎 Location Inquiry
* 👥 User & Role Management

The system is designed around a structured tea warehouse environment where tea stocks are stored using **racks, levels, locations, and plates**.

---

# 🎯 Main Objective

The main objective of BrewSmart is to develop a centralized intelligent warehouse management system that improves inventory visibility, warehouse space utilization, location allocation, and operational decision-making through automation and AI-based warehouse optimization.

### Specific Objectives

1. Digitize tea warehouse inventory operations.
2. Improve warehouse location allocation.
3. Reduce manual data entry and record-keeping.
4. Track tea stock and warehouse locations.
5. Automatically calculate required storage plates.
6. Identify suitable warehouse locations automatically.
7. Generate operational and management reports.
8. Provide a centralized dashboard for warehouse operations.
9. Improve warehouse efficiency and data accuracy.

---

# 🏭 Warehouse Structure

The BrewSmart warehouse model is designed to support:

| Component           | Quantity |
| ------------------- | -------: |
| Racks               |       20 |
| Levels per Rack     |        6 |
| Warehouse Locations |       68 |
| Bags per Plate      |       10 |

The system can be configured according to the actual warehouse structure.

---

# 📦 Smart Plate Allocation

One of the main features of BrewSmart is intelligent plate allocation.

For example:

```text
Invoice: INV-69
Tea Grade: BOP
Number of Bags: 20
Maximum Bags per Plate: 10
```

The system automatically calculates the required number of plates.

```text
Required Plates = Ceiling(Number of Bags / Bags per Plate)
```

Example:

```text
Ceiling(20 / 10) = 2 Plates
```

The system can then identify suitable available warehouse locations.

### Example

```text
Plate 01 → Location R01-L01
Plate 02 → Location R01-L02
```

This helps reduce manual location searching and improves warehouse space utilization.

---

# 🤖 Artificial Intelligence Features

BrewSmart incorporates AI/ML components to support warehouse-related decision-making.

## 1. Intelligent Warehouse Allocation

The system can recommend suitable warehouse locations based on:

* Available capacity
* Rack
* Level
* Location status
* Plate requirements
* Existing stock
* Storage constraints

The objective is to help warehouse staff select suitable locations efficiently.

---

# 📊 Main System Modules

## 1. Dashboard

Provides an overview of warehouse operations.

Example information:

* Total inventory
* Available locations
* Occupied locations
* Available plates
* Total tea stock
* Recent inventory activities
* Warehouse utilization
* System alerts

---

## 2. Inventory Management

Users can:

* Add inventory
* Edit inventory
* View inventory
* Search inventory
* Track stock
* Update quantities
* View inventory details
* Track warehouse locations

### Inventory Information

```text
Invoice Number
Tea Grade
Tea Type
Number of Bags
Weight per Bag
Total Weight
Warehouse Location
Plate Number
Date
Status
```

---

## 3. Warehouse Location Management

The system manages the warehouse using a structured hierarchy:

```text
Rack
 └── Level
      └── Location
           └── Plate
                └── Tea Stock
```

Users can check:

* Available locations
* Occupied locations
* Location details
* Rack details
* Level details
* Stored stock information

---

## 4. Location Inquiry

Users can search for a specific warehouse location.

Example:

```text
Location: R05-L03

Status: Occupied
Plate: PLT-102
Invoice: INV-69
Grade: BOP
Bags: 10
Weight: 650 KG
```

The system allows users to quickly identify where specific stock is stored.

---

## 5. Tea Inventory Information

Tea inventory records can include:

* Invoice number
* Tea grade
* Tea type
* Number of bags
* Weight per bag
* Total weight
* Supplier / manufacturer
* Warehouse location
* Plate number
* Storage date
* Inventory status

---

## 6. Reports

BrewSmart can generate operational reports.

### Inventory Reports

* Current inventory
* Stock by grade
* Stock by location
* Stock by invoice
* Stock quantity reports

### Warehouse Reports

* Occupied locations
* Available locations
* Rack utilization
* Level utilization
* Warehouse capacity

---

# 👥 User Roles

BrewSmart supports role-based access.

## Administrator

Can:

* Manage users
* Manage warehouse configuration
* Manage inventory
* View reports
* Manage system settings

## Warehouse Staff

Can:

* Add inventory
* Update inventory
* Check locations
* Allocate plates
* Perform location inquiries

## Manager

Can:

* View dashboard
* View reports
* Analyze warehouse utilization
* Review inventory
* View warehouse allocation recommendations

---

# 🛠️ Technology Stack

### Frontend

* React.js
* HTML5
* CSS3
* JavaScript

### Backend

* PHP
* REST API integration

### AI / Machine Learning

* Python

### Database

* MySQL

### Development Tools

* Visual Studio Code
* XAMPP
* MySQL / phpMyAdmin
* Git
* GitHub

---

# 📁 Project Structure

```text
BrewSmart/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── assets/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── api/
│   └── uploads/
│
├── database/
│   ├── brewsMart.sql
│   └── database_documentation.md
│
├── ai/
│   ├── models/
│   ├── datasets/
│   ├── notebooks/
│   ├── training/
│   └── prediction/
│
├── reports/
│
├── documentation/
│   ├── ER_Diagram/
│   ├── Use_Case_Diagram/
│   ├── Sequence_Diagram/
│   └── System_Documentation/
│
├── tests/
│
├── screenshots/
│
├── README.md
└── LICENSE
```

---

# ⚙️ System Requirements

## Hardware

Recommended:

* Intel Core i5 or higher
* 8 GB RAM or higher
* 10 GB available storage
* Internet connection for development dependencies

## Software

Install:

* XAMPP
* PHP
* MySQL
* Python 3.x
* Node.js and npm
* Visual Studio Code
* Git

---

# 🚀 Installation

## Step 1 – Clone the Project

```bash
git clone https://github.com/your-username/BrewSmart.git
```

Navigate to the project:

```bash
cd BrewSmart
```

---

## Step 2 – Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

The frontend can then be accessed through the URL displayed in the terminal.

---

## Step 3 – Database Setup

Start the following services using XAMPP:

```text
Apache
MySQL
```

Open:

```text
phpMyAdmin
```

Create the database:

```sql
CREATE DATABASE brewsMart;
```

Import:

```text
database/brewsMart.sql
```

---

# 🐍 Step 4 – Setup Python Environment

Navigate to the AI directory:

```bash
cd ai
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install the required libraries:

```bash
pip install pandas numpy scikit-learn joblib
```

---

# ▶️ Running the System

### Start Backend

Start **Apache** and **MySQL** through XAMPP.

Place the backend project inside:

```text
C:\xampp\htdocs\
```

For example:

```text
C:\xampp\htdocs\BrewSmart
```

### Start Frontend

Open a terminal inside the frontend folder:

```bash
cd frontend
npm run dev
```

Open the local development URL shown by Vite in the terminal.

### Start AI Service

Navigate to:

```text
ai/
```

Activate the virtual environment:

```bash
venv\Scripts\activate
```

Run the AI service:

```bash
python app.py
```

The exact command may vary depending on the final AI implementation.

---

# 🔐 Security

BrewSmart should implement appropriate security controls including:

* User authentication
* Password hashing
* Role-based access control
* Input validation
* SQL injection prevention
* Session management
* File upload validation
* Secure API communication

---

# 🧪 Testing

The system should be tested using several testing approaches.

## Unit Testing

Testing individual functions and modules.

## Integration Testing

Testing communication between:

```text
Frontend
    ↓
Backend
    ↓
Database
```

and:

```text
Backend
    ↓
AI Model
    ↓
Warehouse Allocation Recommendation
```

## System Testing

Testing the complete BrewSmart system.

## User Acceptance Testing

Testing the system against actual warehouse-related requirements.

---

# 📈 Expected Benefits

BrewSmart is expected to provide:

* Improved warehouse visibility
* Faster location inquiries
* Reduced manual work
* Better inventory accuracy
* Improved warehouse space utilization
* Faster plate allocation
* Better stock tracking
* Data-driven warehouse decision-making
* Improved operational reporting
* More efficient warehouse management

---

# 🔮 Future Enhancements

Potential future improvements include:

* 📱 Mobile application
* 📷 QR / Barcode scanning
* 📊 Advanced warehouse analytics
* 🤖 Automated warehouse allocation
* ☁️ Cloud deployment
* 🔔 Real-time notifications
* 🔗 Integration with enterprise systems

---

# 📚 Academic Project

### Project Title

**BrewSmart: AI-Based Smart Tea Warehouse Management & Optimization System**

### Project Type

Final-Year Software Engineering Project

### Primary Domain

```text
Artificial Intelligence
        +
Warehouse Management
        +
Tea Industry
        +
Software Engineering
```

---

# 👨‍💻 Developer

**Umith Keerthisingha**

Software Engineering Undergraduate

**ICBT Campus**
**Cardiff Metropolitan University**

---

# 📄 Project Status

```text
🚧 Under Development
```

BrewSmart is being developed as an academic Software Engineering project focused on intelligent tea warehouse management, inventory optimization, warehouse location allocation, and AI-assisted decision support.

---

# 📜 License

This project is developed for academic and educational purposes.

All rights reserved unless otherwise specified.

---

# 🙏 Acknowledgements

Special thanks to the academic supervisors, industry professionals, and all individuals who provided guidance and domain knowledge during the development of BrewSmart.

---

# ⭐ BrewSmart

### Smart Warehouse. Intelligent Tea Management. Better Decisions.

🍃 **BrewSmart – Bringing Intelligence to Tea Warehouse Operations.**
