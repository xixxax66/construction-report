# Construction Report

เว็บแอปรายงานการควบคุมงานก่อสร้างสำหรับบันทึกข้อมูลโครงการ รายงานรายสัปดาห์ รายงานประจำเดือน ภาพถ่าย และการสำรองข้อมูลผ่าน Google Apps Script

## เริ่มใช้งาน

เปิด `index.html` ผ่านเว็บเซิร์ฟเวอร์แบบ static เช่น VS Code Live Server หรือคำสั่ง:

```bash
python3 -m http.server 8080
```

จากนั้นเปิด `http://localhost:8080`

## โครงสร้างข้อมูล

- `LOCAL_BASIC_INFO_<projectId>` ข้อมูลพื้นฐานแยกตามโครงการ
- `CONSTRUCTION_WEEKLY_REF_DB_<projectId>_<month>` ข้อมูลอ้างอิงรายสัปดาห์
- `WEEK_LOG_DATA_<projectId>_<month>_<week>` บันทึกการปฏิบัติงาน
- `WEEK_PROGRESS_DATA_<projectId>_<month>_<week>` ความก้าวหน้า
- `WEEK_PHOTO_DATA_<projectId>_<month>_<week>` ภาพถ่าย
- `MONTHLY_<section>_<projectId>_<month>` ส่วนข้อมูลรายงานประจำเดือน

คีย์รูปแบบเดิมยังอ่านได้เพื่อรองรับข้อมูลที่บันทึกก่อนการปรับปรุง แต่การบันทึกใหม่จะใช้คีย์แบบแยกโครงการและรอบเดือน

## การตรวจสอบ

```bash
node tests/static-check.js
```

ชุดตรวจสอบจะตรวจไวยากรณ์ JavaScript, token ที่ทำให้โค้ดเสีย, path ของไฟล์ส่วนกลาง และ helper สำคัญสำหรับการแยกข้อมูลและคำนวณระยะเวลาสัญญา

## หมายเหตุด้านความปลอดภัย

ไฟล์ JSON ตัวอย่างใน `assets/` อาจมีข้อมูลโครงการจริง ก่อนเผยแพร่ repository แบบสาธารณะควรตรวจและลบข้อมูลส่วนบุคคลหรือข้อมูลสัญญาที่ไม่ต้องการเปิดเผย ส่วนสิทธิ์การเข้าถึง Google Drive ต้องบังคับใช้ใน `Code.gs` ฝั่งเซิร์ฟเวอร์ด้วย
