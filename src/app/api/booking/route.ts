import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// ─── Table creation ────────────────────────────────────────────────────────────
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS booking_products (
    id              SERIAL PRIMARY KEY,
    section_order   INTEGER      NOT NULL,
    section_name    VARCHAR(100) NOT NULL,
    is_vat_included BOOLEAN      NOT NULL DEFAULT false,
    subgroup_order  INTEGER      NOT NULL DEFAULT 0,
    subgroup_name   VARCHAR(100)          DEFAULT '',
    product_name    VARCHAR(200) NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_free         BOOLEAN      NOT NULL DEFAULT false,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    current_qty     DECIMAL(10,3)         DEFAULT 0,
    updated_at      TIMESTAMP             DEFAULT NOW()
  )
`

// ─── Seed data (from Excel กล่อง 9^16.3.xlsx) ─────────────────────────────────
// Columns: (section_order, section_name, is_vat_included, subgroup_name, subgroup_order,
//           product_name, unit_price, is_free, sort_order)
const SEED = `
INSERT INTO booking_products
  (section_order,section_name,is_vat_included,subgroup_name,subgroup_order,product_name,unit_price,is_free,sort_order)
VALUES
(1,'กล่อง',true,'',0,'00ม.พ.',0.68,false,1),
(1,'กล่อง',true,'',0,'00',0.74,false,2),
(1,'กล่อง',true,'',0,'0',0.90,false,3),
(1,'กล่อง',true,'',0,'0+4',1.16,false,4),
(1,'กล่อง',true,'',0,'00+',2.21,false,5),
(1,'กล่อง',true,'',0,'AA',1.21,false,6),
(1,'กล่อง',true,'',0,'A',1.36,false,7),
(1,'กล่อง',true,'',0,'AB',1.64,false,8),
(1,'กล่อง',true,'',0,'2A',1.73,false,9),
(1,'กล่อง',true,'',0,'AH',3.47,false,10),
(1,'กล่อง',true,'',0,'Q',2.23,false,11),
(1,'กล่อง',true,'',0,'B',2.13,false,12),
(1,'กล่อง',true,'',0,'B+7',2.85,false,13),
(1,'กล่อง',true,'',0,'2B',2.89,false,14),
(1,'กล่อง',true,'',0,'BH',4.48,false,15),
(1,'กล่อง',true,'',0,'C',2.93,false,16),
(1,'กล่อง',true,'',0,'2C',4.07,false,17),
(1,'กล่อง',true,'',0,'CD',1.78,false,18),
(1,'กล่อง',true,'',0,'C+8',3.78,false,19),
(1,'กล่อง',true,'',0,'C+9',4.83,false,20),
(1,'กล่อง',true,'',0,'D-7',4.56,false,21),
(1,'กล่อง',true,'',0,'D',4.03,false,22),
(1,'กล่อง',true,'',0,'D+11',5.40,false,23),
(1,'กล่อง',true,'',0,'2D',5.70,false,24),
(1,'กล่อง',true,'',0,'S+',4.75,false,25),
(1,'กล่อง',true,'',0,'E',5.25,false,26),
(1,'กล่อง',true,'',0,'F',5.92,false,27),
(1,'กล่อง',true,'',0,'Fกลาง',7.40,false,28),
(1,'กล่อง',true,'',0,'F+',9.60,false,29),
(1,'กล่อง',true,'',0,'2F',6.64,false,30),
(1,'กล่อง',true,'',0,'ฉ',7.76,false,31),
(1,'กล่อง',true,'',0,'M',6.50,false,32),
(1,'กล่อง',true,'',0,'M+',9.31,false,33),
(1,'กล่อง',true,'',0,'G',7.28,false,34),
(1,'กล่อง',true,'',0,'H',12.37,false,35),
(1,'กล่อง',true,'',0,'L',12.08,false,36),
(1,'กล่อง',true,'',0,'7',11.25,false,37),
(1,'กล่อง',true,'',0,'P1',7.05,false,38),
(1,'กล่อง',true,'',0,'P2',10.55,false,39),
(1,'กล่อง',true,'',0,'P3',7.95,false,40),
(1,'กล่อง',true,'',0,'P4',18.24,false,41),
(1,'กล่อง',true,'',0,'1',18.74,false,42),
(1,'กล่อง',true,'',0,'2',11.86,false,43),
(1,'กล่อง',true,'',0,'7(5ชั้น)',22.40,false,44),
(1,'กล่อง',true,'',0,'I (3ชั้น)',16.50,false,45),
(1,'กล่อง',true,'',0,'I (5ชั้น)',29.00,false,46),
(1,'กล่อง',true,'',0,'T1',1.63,false,47),
(1,'กล่อง',true,'',0,'T2',3.78,false,48),
(1,'กล่อง',true,'',0,'2E',9.51,false,49),
(2,'ซองน้ำตาล',false,'ซองน้ำตาล',1,'5x8',0.88,false,1),
(2,'ซองน้ำตาล',false,'ซองน้ำตาล',1,'7x10',0.92,false,2),
(2,'ซองน้ำตาล',false,'ซองน้ำตาล',1,'9x12.75',1.35,false,3),
(2,'ซองน้ำตาล',false,'ซองน้ำตาล',1,'10x15',1.63,false,4),
(2,'ซองน้ำตาล',false,'ซองน้ำตาล',1,'15x19',3.42,false,5),
(2,'ซองน้ำตาล',false,'ซองขยายข้าง',2,'9x12.75+2',2.31,false,6),
(2,'ซองน้ำตาล',false,'ซองขยายข้าง',2,'10x15+2',3.47,false,7),
(2,'ซองน้ำตาล',false,'ซองขยายข้าง',2,'11x17+2',3.53,false,8),
(2,'ซองน้ำตาล',false,'ซองจ่าหน้า',3,'6x9',1.44,false,9),
(2,'ซองน้ำตาล',false,'ซองจ่าหน้า',3,'7x10',1.55,false,10),
(2,'ซองน้ำตาล',false,'ซองจ่าหน้า',3,'9x12.75',1.85,false,11),
(2,'ซองน้ำตาล',false,'ซองบับเบิล',4,'6x9',0.74,false,12),
(2,'ซองน้ำตาล',false,'ซองบับเบิล',4,'7x10',1.03,false,13),
(2,'ซองน้ำตาล',false,'ซองบับเบิล',4,'9x12.75',1.35,false,14),
(2,'ซองน้ำตาล',false,'PP กันกระแทก',5,'5*8',0.90,false,15),
(2,'ซองน้ำตาล',false,'PP กันกระแทก',5,'7x9.2',1.44,false,16),
(2,'ซองน้ำตาล',false,'PP กันกระแทก',5,'8x10',1.73,false,17),
(2,'ซองน้ำตาล',false,'PP กันกระแทก',5,'10x12',2.67,false,18),
(2,'ซองน้ำตาล',false,'PP กันกระแทก',5,'11x15+2',3.63,false,19),
(2,'ซองน้ำตาล',false,'เทป OPP',6,'ใส 45',12.04,false,20),
(2,'ซองน้ำตาล',false,'เทป OPP',6,'ใส 100',23.60,false,21),
(2,'ซองน้ำตาล',false,'เทป OPP',6,'ทึบ 45',12.04,false,22),
(2,'ซองน้ำตาล',false,'เทป OPP',6,'ทึบ 100',23.60,false,23),
(2,'ซองน้ำตาล',false,'เทประวังแตก',7,'เหลือง',11.50,false,24),
(2,'ซองน้ำตาล',false,'เทประวังแตก',7,'ดำ',11.50,false,25),
(2,'ซองน้ำตาล',false,'เทประวังแตก',7,'แดง',11.50,false,26),
(2,'ซองน้ำตาล',false,'เทประวังแตก',7,'ขาว',11.50,false,27),
(2,'ซองน้ำตาล',false,'เทป OPP แกนส้ม (ใหม่)',8,'ใส 45',9.00,false,28),
(2,'ซองน้ำตาล',false,'เทป OPP แกนส้ม (ใหม่)',8,'ใส 100',17.50,false,29),
(2,'ซองน้ำตาล',false,'เทป OPP แกนส้ม (ใหม่)',8,'ทึบ 45',9.00,false,30),
(2,'ซองน้ำตาล',false,'เทป OPP แกนส้ม (ใหม่)',8,'ทึบ 100',18.00,false,31),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'เขียว',20.33,false,32),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'ชมพู',20.33,false,33),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'บานเย็น',20.33,false,34),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'ฟ้า',20.33,false,35),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'ม่วง',20.33,false,36),
(2,'ซองน้ำตาล',false,'เทป THANK YOU',9,'เหลือง',20.33,false,37),
(2,'ซองน้ำตาล',false,'กล่องเอกสาร',10,'NO.01',28.36,false,38),
(2,'ซองน้ำตาล',false,'กล่องเอกสาร',10,'No.03',33.23,false,39),
(2,'ซองน้ำตาล',false,'กล่องเอกสาร',10,'No.04',38.00,false,40),
(3,'ซอง PP',false,'ซอง PP',1,'0/17x30',0.75,false,1),
(3,'ซอง PP',false,'ซอง PP',1,'1/25x35',1.25,false,2),
(3,'ซอง PP',false,'ซอง PP',1,'2/28x42',1.69,false,3),
(3,'ซอง PP',false,'ซอง PP',1,'3/32x45',2.10,false,4),
(3,'ซอง PP',false,'ซอง PP',1,'4/38x52',2.85,false,5),
(3,'ซอง PP',false,'ซอง PP',1,'5/45x60',3.75,false,6),
(3,'ซอง PP',false,'ซอง PP',1,'6/50x70',5.20,false,7),
(3,'ซอง PP',false,'ซอง PP',1,'7/60x80',6.70,false,8),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'0/17x30',0.70,false,9),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'1/25x35',1.00,false,10),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'2/28x42',1.20,false,11),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'3/32x45',1.60,false,12),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'4/38x52',2.30,false,13),
(3,'ซอง PP',false,'ซองเมทาลิค',2,'5/45x60',3.10,false,14),
(3,'ซอง PP',false,'ซองสี',3,'0/17x30',0.75,false,15),
(3,'ซอง PP',false,'ซองสี',3,'1/25x35',1.25,false,16),
(3,'ซอง PP',false,'ซองสี',3,'2/28x42',1.69,false,17),
(3,'ซอง PP',false,'ซองสี',3,'3/32x45',2.10,false,18),
(3,'ซอง PP',false,'ซองสี',3,'4/38x52',2.85,false,19),
(3,'ซอง PP',false,'สติ๊กเกอร์ลาเบล100*150',4,'350 แผ่น',85.00,false,20),
(3,'ซอง PP',false,'ฟิล์มยืด',5,'15x250',90.00,false,21),
(3,'ซอง PP',false,'ฟิล์มยืด',5,'15x300',125.00,false,22),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'45 cm',7.43,false,23),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'55 cm',8.07,false,24),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'65 cm',8.82,false,25),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'75 cm',9.56,false,26),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'85 cm',10.21,false,27),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'95 cm',10.96,false,28),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'100 cm',11.33,false,29),
(3,'ซอง PP',false,'กระบอก 2 inc',6,'120 cm',12.83,false,30),
(3,'ซอง PP',false,'กระบอก 3 inc',7,'45 cm',9.92,false,31),
(3,'ซอง PP',false,'กระบอก 3 inc',7,'55 cm',10.99,false,32),
(3,'ซอง PP',false,'กระบอก 3 inc',7,'65 cm',12.12,false,33),
(3,'ซอง PP',false,'ฝากระบอก',8,'ฝามินิ',1.50,false,34),
(3,'ซอง PP',false,'ฝากระบอก',8,'ฝา2นิ้ว',2.00,false,35),
(3,'ซอง PP',false,'ฝากระบอก',8,'ฝา3นิ้ว',2.50,false,36),
(3,'ซอง PP',false,'ถุงหิ้วบริการ',9,'9x18',30.00,false,37),
(3,'ซอง PP',false,'ถุงหิ้วบริการ',9,'12x20',30.00,false,38),
(3,'ซอง PP',false,'ถุงหิ้วบริการ',9,'12x26',30.00,false,39),
(3,'ซอง PP',false,'ถุงหิ้วบริการ',9,'15x30',30.00,false,40),
(3,'ซอง PP',false,'ถุงหิ้วบริการ',9,'18x36',30.00,false,41),
(4,'บับเบิล',false,'บับเบิล',1,'32.5x100',103.79,false,1),
(4,'บับเบิล',false,'บับเบิล',1,'65x100',197.95,false,2),
(4,'บับเบิล',false,'บับเบิล',1,'130x100',395.90,false,3),
(4,'บับเบิล',false,'โฟมบาง 2 มิล',2,'32.5x150',244.00,false,4),
(4,'บับเบิล',false,'โฟมบาง 2 มิล',2,'65x150',482.00,false,5),
(4,'บับเบิล',false,'โฟมบาง 2 มิล',2,'130x150',900.00,false,6),
(4,'บับเบิล',false,'ตัดเทป',3,'รุ่นล็อค',42.80,false,7),
(4,'บับเบิล',false,'ตัดเทป',3,'รุ่นมีเบรค',37.45,false,8),
(4,'บับเบิล',false,'ตัดเทป',3,'Shocking Pink',15.00,false,9),
(4,'บับเบิล',false,'สายรัด PP',4,'12มิล',230.99,false,10),
(4,'บับเบิล',false,'สายรัด PP',4,'15มิล',193.67,false,11),
(4,'บับเบิล',false,'กระดาษห่อ',5,'A 80g',2.80,false,12),
(4,'บับเบิล',false,'กระดาษห่อ',5,'A 110g',3.40,false,13),
(4,'บับเบิล',false,'กระดาษห่อ',5,'KA 125g',4.90,false,14),
(4,'บับเบิล',false,'สติ๊กเกอร์ระวังแตก',6,'แดง',95.00,false,15),
(4,'บับเบิล',false,'กระดาษฝอย',7,'พิเศษ A',225.00,false,16),
(4,'บับเบิล',false,'กระดาษฝอย',7,'พิเศษ B',200.00,false,17),
(4,'บับเบิล',false,'กระดาษฝอย',7,'รุ่นสีอ่อน',100.00,false,18),
(4,'บับเบิล',false,'กระดาษฝอย',7,'รุ่นปุยนุ่น',150.00,false,19),
(4,'บับเบิล',false,'ซองใสปะหน้า',8,'14.5x18cm.',1.00,false,20),
(4,'บับเบิล',false,'ซองใสปะหน้า',8,'17x25cm.',1.50,false,21),
(4,'บับเบิล',false,'ปากกาเขียนPP (แพ็ค10)',9,'1หัว',2.00,false,22),
(4,'บับเบิล',false,'ปากกาเขียนPP (แพ็ค10)',9,'2หัว',3.00,false,23),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'00',0.74,false,1),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'0',0.93,false,2),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'0+4',1.20,false,3),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'A',1.40,false,4),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'AA',1.25,false,5),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'2A',1.73,false,6),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'AB',1.64,false,7),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'B',2.20,false,8),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'2B',2.98,false,9),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'C',3.02,false,10),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'D',4.15,false,11),
(5,'กล่อง Thank You',false,'กล่อง Thank You',1,'E',5.25,false,12),
(5,'กล่อง Thank You',false,'กล่องผลไม้',2,'S+',16.00,false,13),
(5,'กล่อง Thank You',false,'กล่องผลไม้',2,'D+11',18.00,false,14),
(5,'กล่อง Thank You',false,'กล่องผลไม้',2,'M',20.00,false,15),
(5,'กล่อง Thank You',false,'กล่องผลไม้',2,'M+',24.00,false,16),
(5,'กล่อง Thank You',false,'กล่องผลไม้',2,'L',30.00,false,17),
(5,'กล่อง Thank You',false,'ถุงแก้วฝากาว 60 ไมครอน/แพ็ค 100ใบ',3,'20*34',64.20,false,18),
(5,'กล่อง Thank You',false,'ถุงแก้วฝากาว 60 ไมครอน/แพ็ค 100ใบ',3,'25*35',74.90,false,19),
(5,'กล่อง Thank You',false,'ถุงแก้วฝากาว 60 ไมครอน/แพ็ค 100ใบ',3,'28*40',90.95,false,20),
(5,'กล่อง Thank You',false,'ถุงแก้วฝากาว 60 ไมครอน/แพ็ค 100ใบ',3,'32*45',112.35,false,21),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'15*20',64.20,false,22),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'20*25',74.90,false,23),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'25*30',101.65,false,24),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'30*35',128.40,false,25),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'35*45',171.20,false,26),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'40*50',208.65,false,27),
(5,'กล่อง Thank You',false,'ถุงซิปรูด/แพ็ค 50ใบ',4,'50*60',272.85,false,28),
(5,'กล่อง Thank You',false,'เชือกขาว / เชือกฟาง',5,'เชือกฟาง',32.00,false,29),
(5,'กล่อง Thank You',false,'เชือกขาว / เชือกฟาง',5,'500 g.',55.00,false,30),
(5,'กล่อง Thank You',false,'เชือกขาว / เชือกฟาง',5,'1 kg.',114.00,false,31),
(5,'กล่อง Thank You',false,'เบิกของ ฟรี',6,'บิลสี 1000/ห่อ',0.00,true,32),
(5,'กล่อง Thank You',false,'เบิกของ ฟรี',6,'โบรชัวร์ /200',0.00,true,33),
(5,'กล่อง Thank You',false,'เบิกของ ฟรี',6,'สายคาด 500/มัด',0.00,true,34),
(6,'ซองกันกระแทก',false,'ซองกันกระแทก',1,'6x9',2.68,false,1),
(6,'ซองกันกระแทก',false,'ซองกันกระแทก',1,'7x10',3.08,false,2),
(6,'ซองกันกระแทก',false,'ซองกันกระแทก',1,'9x12.75',3.70,false,3),
(6,'ซองกันกระแทก',false,'AirBag แผ่น /เมตรละ',2,'No.30',5.00,false,4),
(6,'ซองกันกระแทก',false,'AirBag แผ่น /เมตรละ',2,'No.45',5.00,false,5),
(6,'ซองกันกระแทก',false,'AirBag แผ่น /เมตรละ',2,'No.610',5.00,false,6),
(6,'ซองกันกระแทก',false,'AirBag แผ่น /เมตรละ',2,'No.1016',4.00,false,7),
(6,'ซองกันกระแทก',false,'AirBag ม้วน',3,'No.30',1200.00,false,8),
(6,'ซองกันกระแทก',false,'AirBag ม้วน',3,'No.45',1200.00,false,9),
(6,'ซองกันกระแทก',false,'AirBag ม้วน',3,'No.610',1200.00,false,10),
(6,'ซองกันกระแทก',false,'AirBag ม้วน',3,'No.1016',700.00,false,11),
(6,'ซองกันกระแทก',false,'MINI AIR',4,'รุ่น 1003',8346.00,false,12),
(6,'ซองกันกระแทก',false,'MINI AIR',4,'รุ่น1002',5493.00,false,13),
(6,'ซองกันกระแทก',false,'ถุงเปล่า 30 กรัม',5,'ถุง 30 กรัม',1.00,false,14),
(6,'ซองกันกระแทก',false,'กระบอก 1.5 inc',6,'34cm',6.80,false,15),
(6,'ซองกันกระแทก',false,'กระดาษฝอยหนา 4 มิล',7,'พิเศษ A',250.00,false,16),
(6,'ซองกันกระแทก',false,'กระดาษฝอยหนา 4 มิล',7,'พิเศษ B',225.00,false,17),
(6,'ซองกันกระแทก',false,'กระดาษฝอยหนา 4 มิล',7,'รุ่นสีอ่อน',125.00,false,18),
(6,'ซองกันกระแทก',false,'กระดาษฝอย เส้นหยัก',8,'พิเศษ A',275.00,false,19),
(6,'ซองกันกระแทก',false,'กระดาษฝอย เส้นหยัก',8,'พิเศษ B',250.00,false,20),
(6,'ซองกันกระแทก',false,'กระดาษฝอย เส้นหยัก',8,'รุ่นสีอ่อน',150.00,false,21),
(6,'ซองกันกระแทก',false,'เครื่อง Peripage /สติ๊กเกอร์ /เคส',9,'เครื่อง+STK',856.00,false,22),
(6,'ซองกันกระแทก',false,'เครื่อง Peripage /สติ๊กเกอร์ /เคส',9,'STK.เว้นขอบ',27.30,false,23),
(6,'ซองกันกระแทก',false,'เครื่อง Peripage /สติ๊กเกอร์ /เคส',9,'STKปกติ',26.00,false,24),
(6,'ซองกันกระแทก',false,'เครื่อง Peripage /สติ๊กเกอร์ /เคส',9,'เคสใส',53.50,false,25),
(6,'ซองกันกระแทก',false,'เครื่อง Peripage /สติ๊กเกอร์ /เคส',9,'เคสซิลิโคน',53.50,false,26),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'S+',9.90,false,27),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'M',12.37,false,28),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'M+',17.46,false,29),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'L',24.00,false,30),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'G',16.50,false,31),
(6,'ซองกันกระแทก',false,'กล่อง5ชั้น',10,'H',24.80,false,32)
`

export async function GET() {
  try {
    await pool.query(CREATE_TABLE)
    const { rows: existing } = await pool.query('SELECT COUNT(*) FROM booking_products')
    if (parseInt(existing[0].count) === 0) {
      await pool.query(SEED)
    }
    // Add ฟิล์มยืด สีดำ if not yet present
    await pool.query(`
      INSERT INTO booking_products
        (section_order,section_name,is_vat_included,subgroup_name,subgroup_order,product_name,unit_price,is_free,sort_order)
      SELECT 3,'ซอง PP',false,'ฟิล์มยืด',5,'สีดำ 50x200m',117.70,false,23
      WHERE NOT EXISTS (
        SELECT 1 FROM booking_products
        WHERE section_order=3 AND subgroup_order=5 AND product_name='สีดำ 50x200m'
      )
    `)
    // Add ฟิล์มยืด สีดำ 15mi if not yet present
    await pool.query(`
      INSERT INTO booking_products
        (section_order,section_name,is_vat_included,subgroup_name,subgroup_order,product_name,unit_price,is_free,sort_order)
      SELECT 3,'ซอง PP',false,'ฟิล์มยืด',5,'สีดำ 15mi 50x200m.',117.70,false,24
      WHERE NOT EXISTS (
        SELECT 1 FROM booking_products
        WHERE section_order=3 AND subgroup_order=5 AND product_name='สีดำ 15mi 50x200m.'
      )
    `)
    const { rows } = await pool.query(
      `SELECT bp.*,
              pc.quantity AS stock_qty
       FROM booking_products bp
       LEFT JOIN products_catalog pc
         ON pc.product_name = bp.product_name
         AND pc.group_name  = bp.section_name
       ORDER BY bp.section_order, bp.subgroup_order, bp.sort_order`
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const updates: Array<{ id: number; current_qty: number }> = await request.json()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const { id, current_qty } of updates) {
      await client.query(
        'UPDATE booking_products SET current_qty = $1, updated_at = NOW() WHERE id = $2',
        [current_qty, id]
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, updated: updates.length })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
