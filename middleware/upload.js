const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "aura-estates",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
  },
});

// File filter
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|webp|gif/;

  const extname = filetypes.test(
    require("path").extname(file.originalname).toLowerCase()
  );

  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Images only (jpeg, jpg, png, webp, gif)!"));
  }
}

// Upload middleware
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;