import jsonwebtoken from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

const secret = process.env.SECRET;

export const generateToken = (user) => {
  return jsonwebtoken.sign(user, secret, { expiresIn: "1d" });
};

export const verifyToken = (token) => {
  try {
    return jsonwebtoken.verify(token, secret);
  } catch (error) {
    return false;
  }
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jsonwebtoken.verify(token, secret);

    req.user = decoded; // ✅ VERY IMPORTANT

    next();
  } catch (err) {
    console.error("TOKEN ERROR:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const refreshToken = (token) => {
  return jsonwebtoken.sign(token, secret, { expiresIn: "1d" });
};

export const tokenMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (req.path === "/signin" || req.path === "/signup") {
    next();
    return;
  }
  if (!token) {
    return res.status(401).send("Unauthorized: No token provided");
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).send("Unauthorized: Invalid token");
  } else if (!decoded.userId) {
    return res.status(403).send("Forbidden: Invalid token");
  }
  req.user = decoded;
  next();
};

export const comparePasswords = (plainPassword, hashedPassword) => {
  return bcrypt.compareSync(plainPassword, hashedPassword);
};

export const hashPassword = (password) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

export const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // Use environment variable for email
      pass: process.env.EMAIL_PASS, // Use environment variable for app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER, // Use the same email address for the sender
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
