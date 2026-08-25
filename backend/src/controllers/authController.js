const bcrypt = require("bcrypt");
const { User, Company, CandidateProfile } = require("../models");
const { sequelize } = require("../config/database");
const { signToken, publicUser } = require("../utils/auth");

async function registerHR(req, res) {
  const { name, company, email, password } = req.body;

  if (!name || !company || !email || !password) {
    return res.status(400).json({ message: "Name, company, email and password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const transaction = await sequelize.transaction();

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      where: { email: normalizedEmail },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(409).json({ message: "Email is already registered" });
    }

    const companyRecord = await Company.create(
      { name: company.trim() },
      { transaction }
    );

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create(
      {
        fullName: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "hr",
        companyId: companyRecord.id
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ message: "Unable to create HR account" });
  }
}

async function registerCandidate(req, res) {
  const { name, email, role, password } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({
      message: "Name, email, role and password are required"
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters"
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      where: { email: normalizedEmail },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create(
      {
        fullName: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "candidate"
      },
      { transaction }
    );

    await CandidateProfile.create(
      {
        userId: user.id,
        desiredRole: role
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ message: "Unable to create candidate account" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  try {
    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is not active" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed" });
  }
}

module.exports = {
  registerHR,
  registerCandidate,
  login
};
