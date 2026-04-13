const express = require("express");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const path = require("path");

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://quocanh150423_db_user:anhanh123@cluster0.2me6d25.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri);
const app = express();

app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "wonderland-secret-key",
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.use(passport.initialize());
app.use(passport.session());

function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    res.redirect("/");
  }
}

passport.use(
  "admin-local",
  new LocalStrategy(function (username, password, done) {
    if (username === "Admin" && password === "12345") {
      return done(null, { id: 0, username: "Aptech", role: "admin" });
    }
    return done(null, false, {
      message: "Incorrect admin username or password",
    });
  }),
);

const users = [
  { id: 1, username: "abc", password: "123", role: "guest" },
  { id: 2, username: "user1", password: "user", role: "guest" },
];

passport.use(
  "user-local",
  new LocalStrategy(function (username, password, done) {
    const user = users.find((u) => u.username === username);
    if (!user) {
      return done(null, false, { message: "Incorrect username." });
    }
    if (user.password !== password) {
      return done(null, false, { message: "Incorrect password." });
    }
    return done(null, user);
  }),
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

async function main() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const database = client.db();
    const collection = database.collection("MovieCollection");

    app.set("views", path.join(__dirname, "views"));

    app.get("/", (req, res) => {
      console.log("Received request for /");
      res.sendFile(__dirname + "/Templates/wonderland.html");
    });

    app.get("/views/admin-login.ejs", (req, res) => {
      console.log("Entered into admin-login page");
      res.render("admin-login");
    });

    app.post(
      "/admin-login",
      passport.authenticate("admin-local", {
        successRedirect: "/admin-dashboard",
        failureRedirect: "/admin-error",
      }),
    );

    app.get("/admin-error", (req, res) => {
      res.send(
        '<script>alert("Incorrect Admin username or password"); window.location.href = "/";</script>',
      );
    });

    app.get("/admin-dashboard", (req, res) => {
      console.log("Entered into admin dashboard page");
      res.sendFile(__dirname + "/Templates/movie-list.html");
    });

    app.get("/views/login.ejs", (req, res) => {
      console.log("Entered into user-login page.");
      res.render("login");
    });

    app.post(
      "/user-local",
      passport.authenticate("user-local", {
        successRedirect: "/user-dashboard",
        failureRedirect: "/user-error",
      }),
    );

    app.get("/user-error", (req, res) => {
      res.send(
        '<script>alert("Incorrect username or password"); window.location.href = "/";</script>',
      );
    });

    app.get("/user-dashboard", (req, res) => {
      console.log("Entered into user dashboard page");
      res.sendFile(__dirname + "/Templates/book-seats-form.html");
    });

    app.get("/add-movie-form.html", (req, res) => {
      res.sendFile(__dirname + "/Templates/add-movie-form.html");
    });

    app.get("/book-seats-form.html", (req, res) => {
      res.sendFile(__dirname + "/Templates/book-seats-form.html");
    });

    app.get("/delete-movie-form.html", (req, res) => {
      res.sendFile(__dirname + "/Templates/delete-movie-form.html");
    });

    app.get("/update-seats-form.html", (req, res) => {
      res.sendFile(__dirname + "/Templates/update-seats-form.html");
    });

    app.get("/get-movies", async (req, res) => {
      const category = req.query.category;
      try {
        const movies = await collection.find({ Category: category }).toArray();
        res.status(200).json(movies);
      } catch (error) {
        console.error("Error fetching movies:", error);
        res.status(500).json({ error: "Failed to fetch movies" });
      }
    });

    app.get("/get-all-movies", async (req, res) => {
      try {
        const movies = await collection.find().toArray();
        res.status(200).json(movies);
      } catch (error) {
        console.error("Error fetching movies:", error);
        res.status(500).json({ error: "Failed to fetch movies" });
      }
    });

    app.get("/get-movie-details", async (req, res) => {
      const movieName = req.query.name;
      try {
        const movie = await collection.findOne({ "Movie name": movieName });
        if (movie) {
          res.status(200).json({
            Description: movie["Description"],
            Actors: movie["Actors"],
          });
        } else {
          res.status(404).json({ error: "Movie not found" });
        }
      } catch (error) {
        console.error("Error fetching movie details:", error);
        res.status(500).json({ error: "Failed to fetch movie details" });
      }
    });

    app.post("/add-movie", async (req, res) => {
      try {
        await collection.insertOne(req.body);
        console.log("Added movie to the database");
        res.send(
          '<script>alert("Movie added successfully"); window.location.href = "/admin-dashboard";</script>',
        );
      } catch (error) {
        console.error("Error adding movie:", error);
        res.status(500).send("<h2>Failed to add the movie</h2>");
      }
    });

    app.post("/book-seats", async (req, res) => {
      try {
        const isAdmin =
          req.isAuthenticated() && req.user && req.user.username === "Aptech";
        const movieNameToBook = req.body["Movie name"];
        const seatsToBook = parseInt(req.body["seats-to-book"]);

        const existingMovie = await collection.findOne({
          "Movie name": movieNameToBook,
        });

        if (!existingMovie) {
          return res.send("Movie not found in the database.");
        }

        const availableSeats = existingMovie["Available Seats"];

        if (seatsToBook <= availableSeats) {
          const updatedAvailableSeats = availableSeats - seatsToBook;
          const result = await collection.updateOne(
            { "Movie name": movieNameToBook },
            { $set: { "Available Seats": updatedAvailableSeats } },
          );

          const redirectRoute = isAdmin
            ? "/admin-dashboard"
            : "/user-dashboard";

          if (result.modifiedCount === 1) {
            const alertMessage = `Booking successful for ${seatsToBook} seat(s) in ${movieNameToBook}`;
            return res.send(`
              <script>
                alert("${alertMessage}");
                window.location.href = "${redirectRoute}";
              </script>
            `);
          } else {
            return res.send(`
              <script>
                alert("Failed to update available seats");
                window.location.href = "${redirectRoute}";
              </script>
            `);
          }
        } else {
          return res.send(
            `Not enough seats available for ${seatsToBook} seat(s) in ${movieNameToBook}`,
          );
        }
      } catch (error) {
        console.error("Error booking seats:", error);
        return res.status(500).send("Failed to book seats");
      }
    });

    app.post("/delete-movie", async (req, res) => {
      const movieNameToDelete = req.body["Movie name"];
      try {
        const existingMovie = await collection.findOne({
          "Movie name": movieNameToDelete,
        });

        if (!existingMovie) {
          res.send("Movie not found in the database");
        } else {
          const result = await collection.deleteOne({
            "Movie name": movieNameToDelete,
          });

          if (result.deletedCount === 1) {
            res.send(
              '<script>alert("Movie deleted successfully"); window.location.href = "/admin-dashboard";</script>',
            );
          } else {
            res.send(
              '<script>alert("Failed to delete the movie"); window.location.href = "/";</script>',
            );
          }
        }
      } catch (error) {
        console.error("Error deleting the movie:", error);
        res.status(500).send("Failed to delete the movie");
      }
    });

    app.post("/update-seats", async (req, res) => {
      const movieNameToUpdate = req.body["Movie name"];
      const newAvailableSeats = parseInt(req.body["Available Seats"]);

      try {
        const existingMovie = await collection.findOne({
          "Movie name": movieNameToUpdate,
        });

        if (!existingMovie) {
          res.send(
            '<script>alert("Movie not found in the database"); window.location.href = "/";</script>',
          );
        } else {
          const result = await collection.updateOne(
            { _id: existingMovie._id },
            { $set: { "Available Seats": newAvailableSeats } },
          );

          if (result.modifiedCount === 1) {
            const alertMessage = `Updated available seats for ${movieNameToUpdate} successfully`;
            res.send(
              `<script>alert("${alertMessage}"); window.location.href = "/admin-dashboard";</script>`,
            );
          } else {
            res.status(500).send("Failed to update available seats");
          }
        }
      } catch (error) {
        console.error("Error updating available seats:", error);
        res.status(500).send("Failed to update available seats");
      }
    });

    app.get("/logout", (req, res) => {
      console.log("Logout page activated.");
      req.logout(() => {});
      res.sendFile(__dirname + "/Templates/wonderland.html");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

main().catch(console.error);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
