const express = require("express");
const handlebars = require("express-handlebars");
const mongoose = require("mongoose");
const cheerio = require("cheerio");
const axios = require("axios");
const logger = require("morgan");

const PORT = process.env.PORT || 8080

const app = express();

app.use(logger("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.engine("handlebars", handlebars({
    defaultLayout: "main"
}));
app.set("view engine", "handlebars");

const db = require("./models");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mongoNews";

mongoose.connect(MONGODB_URI,
    {
        useNewUrlParser: true,
        user: process.env.DB_USER,
        pass: process.env.DB_PASSWORD
    })

app.get("/articles-json", function (req, res) {
    db.Article.find()
        .then(function (dbArticle) {
            res.json(dbArticle)
        })
        .catch(function (err) {
            res.json(err)
        })
});

app.get("/articles", function (req, res) {
    db.Article.find({ saved: false }).sort({ "_id": -1 })
        .then(articles => {
            res.render("index", { article: articles })
        })
        .catch(function (err) {
            console.log(err.message);
        });
});

app.get("/scrape", function (req, res) {
    axios.get("https://www.npr.org/sections/pop-culture/")
        .then(function (response) {
            const $ = cheerio.load(response.data);
            $(".item-info").each(function (i, element) {
                const data = {
                    headline: $(element).children("h2").text(),
                    url: $(element).children("h2").children("a").attr("href"),
                    summary: $(element).children("p").text(),
                };

                if (data.headline && data.url) {
                    db.Article.updateOne({ headline: data.headline }, { $set: data, $setOnInsert: { saved: false } }, { upsert: true })
                        .then(function (dbArticle) {
                            console.log("scrape complete");
                        })
                        .catch(function (err) {
                            console.log(err.message);
                        });
                }
            });
        })
        .then(function () {
            db.Article.find({ saved: false })
                .then(articles => {
                    res.render("index", { article: articles })
                })
                .catch(function (err) {
                    console.log(err.message);
                });
        })
})

app.get("/clear", function (req, res) {
    db.Article.deleteMany({}, function (err, doc) {
        res.render("index")
    });
});

app.post("/saved/:id", function (req, res) {
    db.Article.updateOne({ _id: req.params.id }, { $set: { saved: true } }, function (err, doc) {
        res.redirect("/articles")
    });
});

app.get("/saved", function (req, res) {
    db.Article.find({ saved: true }).sort({ "_id": -1 })
        .then(articles => {
            res.render("saved", { article: articles })
        })
        .catch(function (err) {
            console.log(err.message);
        });
});

app.post("/remove/:id", function (req, res) {
    db.Article.updateOne({ _id: req.params.id }, { $set: { saved: false } }, function (err, doc) {
        res.redirect("/saved")
    });
});

// the commented out code is a starter for including notes for saved articles

// app.post("/newNote/:id", function (req, res) {
//     db.Note.create(req.body).then(function (dbNote) {
//         return db.Article.findOneAndUpdate({ _id: req.params.id }, { $push: { notes: dbNote._id } }, { new: true });
//     }).then(function (dbArticle) {
//         res.json(dbArticle);
//     }).catch(function (err) {
//         res.json(err);
//     });
// });

// app.get("/allNotes/:id", function (req, res) {
//     db.Article.findOne({ _id: req.params.id }).populate("notes")
//         .then(function (dbArticle) {
//             res.json(dbArticle);
//         }).catch(function (err) {
//             res.json(err);
//         });
// });

// app.delete("/deleteNote/:noteid", function (req, res) {
//     db.Note.deleteOne({ _id: req.params.noteid }).then(function (data) {
//         res.redirect("/saved")
//     })
// });

app.get("/", function (req, res) {
    res.redirect("/articles")
});

app.listen(PORT, function () {
    console.log("App running on PORT " + PORT);
});
