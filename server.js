const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

app.use(bodyParser.json());
app.use(cors());

mongoose.connect('mongodb://127.0.0.1:27017/ChronosLearning', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String, required: true }], 
});

const Content = mongoose.model('Content', contentSchema);

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    bio: { type: String, required: true },
    image: { type: String, required: true }, 
});

const Course = mongoose.model('Course', courseSchema);

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    age:{ type: Number, required: true},
    cnic: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'), // manage uploads
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)) 
});

const upload = multer({ storage }); // storage

app.post('/add-content', upload.array('images', 2), async (req, res) => {
    const { title, description } = req.body;
    const images = req.files ? req.files.map(file => file.path) : [];

    if (images.length < 2) {
        return res.status(400).json({ error: 'Please upload two images.' });
    }

    try {
        const newContent = new Content({
            title,
            description,
            images,
        });

        const savedContent = await newContent.save();

        res.status(201).json({ message: 'Course content added successfully!', content: savedContent });
    } catch (error) {
        console.error("Error adding content:", error);
        res.status(500).json({ error: 'Error adding course content' });
    }
});

app.post('/add-course', upload.single('image'), async (req, res) => {
    const { title, bio } = req.body;
    const image = req.file ? req.file.path : null; 

    if (!image) {
        return res.status(400).json({ error: 'Image is required' });
    }

    console.log('Uploaded file:', req.file);  

    try {
        const newCourse = new Course({ title, bio, image });

        const savedCourse = await newCourse.save();

        res.status(201).json({ message: 'Course added successfully!', course: savedCourse });
    } catch (error) {
        console.error("Error adding course:", error);
        res.status(500).json({ error: 'Error adding course' });
    }
});

app.use('/uploads', express.static('uploads'));

app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find();

        res.status(200).json(courses);
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ error: 'Error fetching courses' });
    }
});

app.get('/contents', async (req, res) => {
    const { title } = req.query;

    if (!title) {
        return res.status(400).json({ error: 'Course title is required' });
    }

    try {
        const contents = await Content.find({ title: new RegExp(`^${title}$`, 'i') }); 
        if (contents.length === 0) {
            return res.status(404).json({ error: 'No content found for the provided course title' });
        }
        res.status(200).json(contents);
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Error fetching content' });
    }
});

app.delete('/delete-course/:title', async (req, res) => {
    const title = req.params.title.trim();

    try {
        const deletedCourse = await Course.findOneAndDelete({ title: new RegExp(`^${title}$`, 'i') });
        if (!deletedCourse) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.status(200).json({ message: 'Course deleted successfully!', course: deletedCourse });
    } catch (error) {
        console.error("Error deleting course:", error);
        res.status(500).json({ error: 'Error deleting course' });
    }
});

app.post('/enroll-course', async (req, res) => {
    const { title } = req.body;

    try {
        const course = await Course.findOne({ title });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.status(200).json({ message: `Successfully enrolled in ${course.title}!` });


    } catch (error) {
        console.error('Error enrolling in course:', error);
        res.status(500).json({ error: 'Error enrolling in course' });
    }
});

app.post('/reset-password', async (req, res) => {
    const { cnic, pin, newPassword } = req.body;

    try {
        const user = await User.findOne({ cnic, pin });
        if (!user) {
            return res.status(404).json({ error: 'Invalid CNIC or PIN' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
});

app.post('/register', async (req, res) => {
    console.log(req.body); 
    const { firstName, lastName, age, cnic, email, password } = req.body;
    if (!firstName || !lastName || !age || !cnic || !email || !password) {
        return res.status(400).json({ error: 'All fields are required!' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            age,
            cnic,
            email,
            password: hashedPassword
        });

        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User registered successfully!', user: savedUser });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ userId: user._id }, 'secretKey', { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ error: 'Error logging in user' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

});
