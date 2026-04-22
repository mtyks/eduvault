require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const multer = require('multer');
const { Pool } = require('pg');
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { 
    CognitoUserPool, 
    CognitoUser, 
    AuthenticationDetails, 
    CognitoUserAttribute 
} = require('amazon-cognito-identity-js');

const app = express();

// ✅ middleware
app.use(cors());
app.use(express.json());

// --- Database ---
const db = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

// --- AWS ---
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
});
const upload = multer({ storage: multer.memoryStorage() });

const userPool = new CognitoUserPool({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    ClientId: process.env.COGNITO_CLIENT_ID
});

const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.COGNITO_CLIENT_ID,
});

// --- Middleware Auth ---
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const payload = await verifier.verify(token);
        const userRes = await db.query(
            'SELECT * FROM users WHERE cognito_id = $1 OR email = $2', 
            [payload.sub, payload.username]
        );

        if (userRes.rows.length === 0) return res.status(403).json({ error: "User not found" });
        req.user = userRes.rows[0]; 
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid Token" });
    }
};
// ================= API =================

// ✅ LOGIN
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password
    });

    const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (result) => {
            try {
                const userRes = await db.query(
                    'SELECT role FROM users WHERE email = $1',
                    [email]
                );

                const role = userRes.rows.length > 0
                    ? userRes.rows[0].role
                    : 'student';

                res.json({
                    accessToken: result.getAccessToken().getJwtToken(),
                    role: role
                });

            } catch (err) {
res.status(500).json({ error: "Database error" });
            }
        },
        onFailure: (err) => {
            res.status(400).json({ error: err.message });
        }
    });
});


// ✅ REGISTER
app.post('/register', (req, res) => {
    const { email, password, role } = req.body;

    const attributeList = [
        new CognitoUserAttribute({ Name: 'email', Value: email })
    ];

    userPool.signUp(email, password, attributeList, null, async (err, result) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            await db.query(
                'INSERT INTO users (email, role, cognito_id) VALUES ($1, $2, $3)',
                [email, role, result.userSub]
            );

            res.json({ message: "Success" });

        } catch (dbErr) {
            res.status(500).json({ error: dbErr.message });
        }
    });
});
// ✅ CONFIRM
app.post('/confirm', (req, res) => {
    const { email, code } = req.body;

    const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Confirmed" });
    });
});
// ✅ COURSES
app.get('/courses', authenticateToken, async (req, res) => {
    if (req.user.role === 'student') {
        // นักศึกษาเห็นเฉพาะที่มีสิทธิ์ (เหมือนเดิม)
        const result = await db.query(`
            SELECT c.* FROM courses c
            JOIN course_permissions p ON c.id = p.course_id
            WHERE p.student_email = $1
        `, [req.user.email]);
        return res.json(result.rows);
    }
    
    // ✅ แก้ไข: สำหรับอาจารย์ ให้ดึง "ทุกคอร์ส" ในระบบออกมา
    // แต่เรียงลำดับให้คอร์สของตัวเองขึ้นก่อน (Optional)
    const result = await db.query(`
        SELECT *, 
        CASE WHEN teacher_email = $1 THEN 1 ELSE 2 END as priority
        FROM courses 
        ORDER BY priority ASC, created_at DESC
    `, [req.user.email]);
    
    res.json(result.rows);
});
app.post('/courses', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: "Teachers only" });
    }

    const { name, code, description } = req.body;

    const result = await db.query(
        'INSERT INTO courses (course_name, course_code, description, teacher_email) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, code, description, req.user.email]
    );

    res.json(result.rows[0]);
});
// ✅ DELETE COURSE
app.delete('/courses/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    const course = await db.query(
        'SELECT * FROM courses WHERE id = $1 AND teacher_email = $2',
        [id, req.user.email]
    );

    if (course.rows.length === 0) {
        return res.status(403).json({ error: "No permission" });
    }

    await db.query('DELETE FROM courses WHERE id = $1', [id]);

    res.json({ message: "Deleted" });
});

app.delete('/files/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // เช็คว่าไฟล์นี้เป็นของอาจารย์ที่ล็อคอินอยู่หรือไม่
        const fileRes = await db.query(
            'SELECT * FROM files WHERE id = $1 AND uploader_email = $2',
            [id, req.user.email]
        );

        if (fileRes.rows.length === 0) {
            return res.status(403).json({ error: "คุณไม่มีสิทธิ์ลบไฟล์นี้ หรือไม่พบไฟล์" });
        }
// ลบข้อมูลใน Database
        await db.query('DELETE FROM files WHERE id = $1', [id]);

        // หมายเหตุ: ในระบบจริงควรเพิ่มคำสั่ง s3.deleteObject เพื่อลบไฟล์ออกจาก S3 ด้วย

        res.json({ message: "ลบไฟล์สำเร็จ" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ UPLOAD
app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    const file = req.file;
    const { courseId } = req.body;

    if (!file) return res.status(400).json({ error: "No file" });

    const params = {
        Bucket: 'eduvault-files-2024-group10',
        Key: `uploads/${Date.now()}_${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype
    };

   s3.upload(params, async (err, data) => {
    if (err) {
        console.error("❌ S3 Upload Error:", err); // เพิ่มบรรทัดนี้
        return res.status(500).json({ error: "S3 Upload Failed", details: err.message });
    }
try {
        const isLecture = (req.user.role === 'teacher');
        await db.query(
            'INSERT INTO files (file_name, file_url, uploader_email, is_lecture, course_id) VALUES ($1, $2, $3, $4, $5)',
            [file.originalname, data.Location, req.user.email, isLecture, courseId || null]
        );
        res.json({ success: true });
    } catch (dbErr) {
        console.error("❌ Database Insert Error:", dbErr); // เพิ่มบรรทัดนี้
        res.status(500).json({ error: "Database Error", details: dbErr.message });
    }
});
});


// ✅ FILE LIST
// ✅ แก้ไข API: /files (สำหรับหน้า Teacher)
app.get('/files', authenticateToken, async (req, res) => {
    try {
        // ดึงไฟล์ทั้งหมด และ JOIN ชื่อวิชา
        const result = await db.query(`
            SELECT f.*, c.course_name 
            FROM files f
            LEFT JOIN courses c ON f.course_id = c.id
            ORDER BY f.uploaded_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// (เช็คให้แน่ใจว่า SQL มี f.* และ c.course_name แล้ว)
app.get('/lectures', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT f.*, c.course_name 
            FROM files f
            JOIN courses c ON f.course_id = c.id
            JOIN course_permissions p ON f.course_id = p.course_id
            WHERE p.student_email = $1 AND f.is_lecture = true
            ORDER BY f.uploaded_at DESC
        `, [req.user.email]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ให้สิทธิ์ในการดู
// ดึงรายชื่อนักศึกษาทั้งหมด (เพื่อเอามาแสดงในรายชื่อให้เลือก)
// ✅ เพิ่มใหม่: ดึงรายชื่อนักศึกษาพร้อมสถานะ Checkbox (สิทธิ์เดิม)
app.get('/courses/:id/permissions', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`
            SELECT u.email, 
            CASE WHEN p.student_email IS NOT NULL THEN true ELSE false END as has_access
            FROM users u
            LEFT JOIN course_permissions p ON u.email = p.student_email AND p.course_id = $1
            WHERE u.role = 'student'
        `, [id]);
        res.json(result.rows);
    } catch (err) {
res.status(500).json({ error: err.message });
    }
});

// บันทึกการให้สิทธิ์
app.post('/courses/permissions', authenticateToken, async (req, res) => {
    const { courseId, studentEmails } = req.body; // studentEmails เป็น Array [email1, email2]
    
    // ลบสิทธิ์เก่าออกก่อนแล้วเพิ่มใหม่ (หรือจะใช้เทคนิคอื่นก็ได้)
    await db.query('DELETE FROM course_permissions WHERE course_id = $1', [courseId]);
    
    for (const email of studentEmails) {
        await db.query('INSERT INTO course_permissions (course_id, student_email) VALUES ($1, $2)', [courseId, email]);
    }
    res.json({ success: true });
});
app.get('/courses', authenticateToken, async (req, res) => {
    if (req.user.role === 'student') {
        // นักศึกษาจะเห็นเฉพาะวิชาที่มีชื่อตัวเองอยู่ในตาราง permissions
        const result = await db.query(`
            SELECT c.* FROM courses c
            JOIN course_permissions p ON c.id = p.course_id
            WHERE p.student_email = $1
        `, [req.user.email]);
        return res.json(result.rows);
    }
    
    // สำหรับอาจารย์ (ให้ดึงทั้งหมดหรือตาม Filter ที่ทำไว้ก่อนหน้า)
    const result = await db.query('SELECT * FROM courses');
    res.json(result.rows);
});
// ✅ START SERVER
app.listen(3000, () => {
    console.log('🚀 Server is running on port 3000');
});