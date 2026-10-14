import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { encryptStudentNumber } from '../src/services/studentDataService.js';
const db = new PrismaClient();
const hash = await argon2.hash('DemoPass123!');
try {
 const school = await db.institution.upsert({where:{slug:'demo-school'},update:{},create:{slug:'demo-school',name:'Demo University'}});
 for(const p of [{name:'Free',priceCentavos:0,durationDays:3650,maxClasses:2,reportsEnabled:false},{name:'Basic',priceCentavos:19900,durationDays:30,maxClasses:10,reportsEnabled:true},{name:'Premium',priceCentavos:49900,durationDays:30,maxClasses:99999,reportsEnabled:true}])await db.subscriptionPlan.upsert({where:{name:p.name},update:p,create:p});
 const free = await db.subscriptionPlan.findUnique({where:{name:'Free'}});
 await db.subscription.upsert({where:{institutionId:school.id},update:{},create:{institutionId:school.id,planId:free.id}});
 const users=[['admin@demo.edu','Admin Demo','ADMIN'],['professor@demo.edu','Professor Demo','PROFESSOR']];
 for(const [email,name,role] of users)await db.user.upsert({where:{email},update:{},create:{email,name,role,passwordHash:hash,institutionId:school.id}});
 const teacher=await db.user.findUnique({where:{email:'professor@demo.edu'}});
 // Keep any existing demo student record to avoid destroying enrollment history.
 let student=await db.user.findUnique({where:{email:'student@demo.edu'}});
 if(!student)student=await db.user.findUnique({where:{email:'student.demo@no-login.edutrack.invalid'}});
 if(!student)student=await db.user.create({data:{
  institutionId:school.id,role:'STUDENT',name:'Student Demo',
  studentNumber:encryptStudentNumber('S0001'),
  email:'student.demo@no-login.edutrack.invalid',
  passwordHash:await argon2.hash(randomBytes(32).toString('hex'))
 }});
 let klass=await db.class.findFirst({where:{institutionId:school.id,code:'IT101'}});
 if(!klass)klass=await db.class.create({data:{institutionId:school.id,code:'IT101',name:'Introduction to Computing',classroom:'Room 101',professorId:teacher.id}});
 await db.enrollment.upsert({where:{classId_studentId:{classId:klass.id,studentId:student.id}},update:{},create:{classId:klass.id,studentId:student.id}});
 await db.rFIDCredential.upsert({where:{tokenDigest:createHash('sha256').update('DEMO-RFID-001').digest('hex')},update:{},create:{studentId:student.id,tokenDigest:createHash('sha256').update('DEMO-RFID-001').digest('hex')}});
 console.log('Seeded demo Admin and Professor accounts. Demo RFID: DEMO-RFID-001. Student has no login.');
} finally {await db.$disconnect()}
