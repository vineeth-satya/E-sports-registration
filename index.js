const express = require("express");
const app = express();
const session = require("express-session");
const ejs = require("ejs");
const passwordHash = require("password-hash");
const fileUpload = require("express-fileupload");
const { Storage } = require("@google-cloud/storage");

// Initialize Firebase Storage
const storage = new Storage({
  projectId: "project-v-ecea3",
  keyFilename: "./key.json",
});
const bucket = storage.bucket("gs://project-v-ecea3.appspot.com");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: true,
}));

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

var serviceAccount = require("./key.json");
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

app.use(fileUpload()); // Add the fileUpload middleware

app.get("/", function (req, res) {
  res.render("signup.ejs",{errormessage:""});
});

app.get("/signupsubmit", function (req, res) {
  db.collection("usersDemo")
  .where("Email","==",req.query.email)
  .get()
  .then((docs)=>{
    if(docs.size>0){
   
      res.render("signup.ejs",{errormessage:"This account is already existed,Please login"})
    }
    else{
      db.collection("usersDemo")
    .add({
      FullName: req.query.fullname,
      Email: req.query.email,
      Password: passwordHash.generate(req.query.password),
    })
    .then(() => {
      res.render("login.ejs");
    });
    }
  
  
});
})

app.get("/loginsubmit", function (req, res) {
  db.collection("usersDemo")
    .where("Email", "==", req.query.email)
    .get()
    .then((docs) => {
      let verified = false;
      docs.forEach((doc) => {
        // Set the authentication flag in the session
        verified = passwordHash.verify(req.query.password, doc.data().Password);
      });
        if(verified){
          req.session.authenticated = true;
          res.redirect("/dashboard");
        }
        else {
          res.send("login unsuccessful");
        }
      });
});

app.get("/login", function (req, res) {
  res.render("login.ejs");
});

app.get("/dashboard", function (req, res) {
  if (req.session.authenticated) {
    res.render("dashboard.ejs");
  } else {
    res.redirect("/login"); // Redirect to login if not authenticated
  }
});

app.get("/register", function (req, res) {
  res.render("register.ejs");
});

app.post('/success', async (req, res) => {
  try {
    const teamLogoFile = req.files.teamLogo;

    if (!teamLogoFile) {
      return res.status(400).send('No file uploaded.');
    }

    // Check if required fields are defined
    const { tn, t1, t1e, t2, t2e, t3, t3e, t4, t4e } = req.body;
    if (!tn || !t1 || !t1e || !t2 || !t2e || !t3 || !t3e || !t4 || !t4e) {
      return res.status(400).send('Missing required fields.');
    }

    // Generate a unique filename
    const filename = `${Date.now()}-${teamLogoFile.name}`;

    // Create a file reference in the Firebase Storage bucket
    const file = bucket.file(filename);

    // Create a write stream to Firebase Storage
    const fileStream = file.createWriteStream({
      metadata: {
        contentType: teamLogoFile.mimetype,
      },
    });

    // Handle errors during the file upload
    fileStream.on('error', (error) => {
      console.error(error);
      return res.status(500).send('File upload failed.');
    });

    // Handle successful file upload
    fileStream.on('finish', async () => {
      // File uploaded successfully, you can now store the filename in your database
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

      // Save imageUrl to the database (e.g., Firestore)
      await db.collection("Registration Details").add({
        TeamName: tn,
        Teammate1: t1,
        Teammate1email: t1e,
        Teammate2: t2,
        Teammate2email: t2e,
        Teammate3: t3,
        Teammate3email: t3e,
        Teammate4: t4,
        Teammate4email: t4e,
        TeamLogoUrl: imageUrl,
      });

      // Render the success page and pass imageUrl as a variable
      res.render('success.ejs', { imageUrl });
    });

    // Pipe the file data to the Firebase Storage write stream
    fileStream.end(teamLogoFile.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, (req, res) => {
  console.log("App listening on port 3000")
});
