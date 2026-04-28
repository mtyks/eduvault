# AWS-Eduvault
# 🛡️ EduVault: Cloud-Based Learning Management System

**EduVault** เป็นระบบจัดการคลังสื่อการสอนแบบแบ่งสิทธิ์ผู้ใช้งาน (Role-Based Access Control) ที่ทำงานบนโครงสร้างพื้นฐาน **AWS Cloud** แบบ 100% ออกแบบตามสถาปัตยกรรม 3-Tier เพื่อความปลอดภัย ความเสถียร และการปรับขยายขนาด (Scalability)

---

## 🏗️ System Architecture (3-Tier)

ระบบถูกออกแบบมาโดยแยกส่วนการทำงานออกเป็น 3 ชั้นหลัก:

1.  **Presentation Tier (Frontend):** * ใช้ HTML5, Tailwind CSS และ JavaScript
    * Hosting บน **Amazon S3** (Static Website Hosting)
2.  **Logic Tier (Backend):** * Node.js Runtime รันบน **Amazon EC2**
    * จัดการ API Requests, การตรวจสอบสิทธิ์ (JWT Verification) และการจัดการไฟล์
3.  **Data Tier (Database & Storage):**
    * **Amazon Aurora RDS (PostgreSQL):** เก็บข้อมูลเชิงโครงสร้าง เช่น ข้อมูลผู้ใช้, รายวิชา และสิทธิ์การเข้าถึง
    * **Amazon S3 (Storage Bucket):** เก็บไฟล์สื่อการสอนจริง (PDF, Images)

---

## 🛠️ AWS Services Utilized

- **Amazon EC2:** ประมวลผล Backend Logic และ API Server
- **Amazon S3:** จัดเก็บทั้งหน้าเว็บ (Static) และไฟล์สื่อการสอน (Object Storage)
- **Amazon Cognito:** จัดเก็บข้อมูลผู้ใช้และจัดการ Authentication (Login/Register/OTP)
- **Amazon Aurora RDS:** ฐานข้อมูลความเร็วสูงสำหรับจัดการความสัมพันธ์ของข้อมูล
- **AWS IAM:** ควบคุมสิทธิ์การเข้าถึงระหว่างบริการ (เช่น EC2 เข้าถึง S3)

---

## ✨ Key Features

- **Role-Based Access:** แยกหน้าจอมุมมองระหว่าง **อาจารย์ (Teacher)** และ **นักศึกษา (Student)**
- **Secure File Management:** อาจารย์สามารถสร้างรายวิชา และอัปโหลดไฟล์สื่อการสอนได้โดยตรง
- **Access Control:** ระบบตรวจสอบสิทธิ์รายบุคคล (นักศึกษาจะเห็นเฉพาะวิชาที่มีสิทธิ์เข้าเรียนเท่านั้น)
- **Cloud Identity:** ยืนยันตัวตนผ่าน Amazon Cognito พร้อมระบบยืนยันอีเมล

---

## 📂 Database Schema

ระบบใช้ฐานข้อมูล PostgreSQL ประกอบด้วยตารางหลักดังนี้:
- `users`: จัดเก็บข้อมูลพื้นฐานและ Role
- `courses`: ข้อมูลรายวิชาและเจ้าของวิชา
- `files`: ข้อมูล Metadata ของไฟล์ที่จัดเก็บใน S3
- `course_permissions`: ตารางความสัมพันธ์เพื่อกำหนดสิทธิ์การเข้าถึงรายวิชา

---

## 👥 Contributors (Team 2)

โครงการนี้เป็นส่วนหนึ่งของรายวิชา **ICT24467 การพัฒนาซอฟต์แวร์ระบบประมวลผลคลาวด์และความปลอดภัยของข้อมูล** มหาวิทยาลัยศรีปทุม

| รหัสนักศึกษา | ชื่อ-นามสกุล |
| :--- | :--- |
| 67091556 | นายปราโมท ดำคราม |
| 67123359 | นายสุริยะ โพธิ์คลัง |
| 67123506 | นายกอบกิจ โกษาพันธุ์ |
| 67125520 | นางสาวรวิสรา แสงใส |
| 67125537 | นายวุฒติชัย พลขุนทด |
| 67132992 | นายชญานนท์ ธรรมโกศล |
| 67144085 | นายธนชัย เอี่ยมสอาด |
| 67148390 | นายคมกฤษณะ อินกกผึ้ง |
| 67148403 | นายธนพล สิทธิศร |
| 67148427 | นายอาทิตย์ ลังประเสริฐ |

---

## 🎓 Proposed to
**อาจารย์ อำนาต คงเจริญถิ่น** มหาวิทยาลัยศรีปทุม (Sripatum University)
