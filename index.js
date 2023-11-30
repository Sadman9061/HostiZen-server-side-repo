const express = require("express");
const app = express();
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config(); // import env file if use environment variables after install || npm install dotenv --save|| ane Create a .env file in the root of your project:
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// used Middleware
app.use(cors(
    {
        origin: ['http://localhost:5173',
    'https://bistro-boss-be5b4.web.app',
'https://bistro-boss-be5b4.firebaseapp.com'],
        credentials: true
    }
));
app.use(express.json());

// Connect With MongoDb Database

// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.urcdkb0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }

});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect()


        const mealsCollection = client.db('assignment-12').collection('meals');
        const commentsCollection = client.db('assignment-12').collection('comments');
        const requestedMealsCollection = client.db('assignment-12').collection('requestedMeals');
        const paymentCollection = client.db('assignment-12').collection('payments');
        const upComingMealsCollection = client.db('assignment-12').collection('upComingMeals');
        const upComingMealsLikedByCollection = client.db('assignment-12').collection('upComingMealsLikedBy');
        const usersCollection = client.db('assignment-12').collection('users');
        const testimonialsCollection = client.db('assignment-12').collection('testimonials');

        // get all meals 
        app.get('/mealsInfiniteScroll', async (req, res) => {
            const { limit = 2, offset = 0 } = req.query;


            try {
                // Fetch articles from the database based on limit and offset
                const meals = await mealsCollection
                    .find({})
                    .limit(Number(limit))
                    .skip(Number(offset))
                    .toArray();
                // Count total articles for pagination
                const mealsCount = await mealsCollection.countDocuments();

                res.json({ meals, mealsCount });
            } catch (error) {
                console.error('Error fetching articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        app.get('/meals', async (req, res) => {
            const cursor = await mealsCollection.find();
            const result = await cursor.toArray()
            res.send(result);
        })
        app.get('/testimonials', async (req, res) => {
            const cursor = await testimonialsCollection.find();
            const result = await cursor.toArray()
            res.send(result);
        })


        // get single meal 
        app.get('/singleMeals/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollection.findOne(query);
            res.send(result);
        })



        //   likes
        app.patch('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const likes = req.body
            const query = { _id: new ObjectId(id) };
            console.log(id,);
            // Increment likes by 1
            const updatedLikes = likes.likes + 1;
            const updateLikes = {
                $set: {
                    likes: updatedLikes
                }
            };
            console.log(updateLikes);
            const updateResult = await mealsCollection.updateOne(query, updateLikes);
            res.status(200).json({ message: 'Application successful' })
        })

        // reacting comment 
        app.post('/comments', async (req, res) => {
            const comment = req.body;
            const result = await commentsCollection.insertOne(comment);
            res.send(result);
        })
        // getting comment 
        app.get('/comments/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { mealId: id }
            const result = await commentsCollection.find(query).toArray();
            console.log(result);
            res.send(result);
        })

        app.get('/comments', async (req, res) => {
            const filter = req.query;
            console.log(filter);
            const query={}
            const options = {
                sort: {               
                    likes: filter.sortLikes === 'asc' ? 1 : -1,                
                }
            };
            const result = await commentsCollection.find(query,options).toArray()
            res.send(result);
        })
       
        
        // requested Meals collection 
        // payment intent
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            console.log(price);
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            console.log(paymentIntent);
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        // payment gateway 
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            if (paymentResult) {
                const query = { email: payment?.email }
                const update = {
                    $set: {
                        memberShip: payment?.memberShip
                    },
                };
                const updateResult = await usersCollection.updateOne(
                    query,
                    update
                );
                res.send(paymentResult);
            }

        })
        // get up coming meals 
        app.get('/upComingMeals', async (req, res) => {
            try {
                const cursor = await upComingMealsCollection.find();
                const result = await cursor.toArray();
        
                // Sort the result array based on the 'likes' property in descending order
                result.sort((a, b) => b.likes - a.likes);
        
                res.send(result);
            } catch (error) {
                console.error('Error fetching and sorting upcoming meals:', error);
                res.status(500).send('Internal Server Error');
            }
        });
        


        // like up coming meals 
        app.post('/upComingMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const content = req.body;
            const user = { email: content?.email };
            // Check if the user has already liked the post
            const alreadyLiked = await upComingMealsLikedByCollection.findOne({
                $and: [user, { postId: id }],
            });
            if (alreadyLiked) {
                res.status(200).json({ message: 'Already liked' });
            } else {
                const result = await upComingMealsCollection.findOne(query);
                if (result) {
                    // Increment likes by 1
                    const updatedLikes = result.likes + 1;
                    const updateLikes = {
                        $set: {
                            likes: updatedLikes,
                        },
                    };
                    const updateResult = await upComingMealsCollection.updateOne(query, updateLikes);
                    if (updateResult.modifiedCount === 1) {
                        // Save user like in the likedBy collection
                        const likedBy = {
                            email: content.email,
                            postId: id,
                        };
                        const insertResult = await upComingMealsLikedByCollection.insertOne(likedBy);
                        if (insertResult.insertedId) {
                            res.status(200).json({ message: 'Like successful' });
                        }
                    }
                }
            }
        });
        // create users 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        // get all users 

        app.get('/users', async (req, res) => {
            const search = req.query.search;
            console.log(search);        
            const query = {
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ]
            };        
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });
        
        // get single user 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result);
        })
        // get all requested Meals 
        app.post('/requestedMeals', async (req, res) => {
            const meal = req.body;
            const result = await requestedMealsCollection.insertOne(meal);
            res.send(result);
        })

        app.get('/requestedMeals', async (req, res) => {
            try {
                const search = req.query.search;
                if (!search) {
                    // If search parameter is not provided, return all requested meals
                    const result = await requestedMealsCollection.find().toArray();
                    res.send(result);
                } else {
                    // If search parameter is provided, search based on email or name
                    const searchQuery = {
                        $or: [
                            { email: search },
                            { name: { $regex: search, $options: 'i' } }
                        ]
                    };        
                    const cursor = await requestedMealsCollection.find(searchQuery);
                    const result = await cursor.toArray();        
                    res.send(result);
                }
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });
        
        // get user specific requested Meals 
        app.get('/requestedMeals/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const query = { email: email };
                const cursor = await requestedMealsCollection.find(query);
                let result = await cursor.toArray();

                // Custom sorting function based on "pending" and "delivered" status
                result.sort((a, b) => {
                    const statusOrder = { "pending": 1, "delivered": 2 };

                    const statusA = statusOrder[a.status] || 0;
                    const statusB = statusOrder[b.status] || 0;

                    return statusA - statusB;
                });

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });
        app.get('/reviewComments/:email', async (req, res) => {

            const email = req.params.email;
            console.log("email................................................", email);
            console.log('fasdfasf');
            const query = { email: email };
            const cursor = await commentsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);


        });


        app.patch('/updateComments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateJob = req.body;
            console.log(updateJob);
            const updatedJob = {
                $set: {
                    comment: updateJob.comment
                }
            }
            const result = await commentsCollection.updateOne(query, updatedJob, options);
            res.send(result);
        })
        app.get('/singleComment/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await commentsCollection.findOne(query);
            res.send(result);
        })
        app.delete("/deleteReviews/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await commentsCollection.deleteOne(query);
            res.send(result);
        });

        app.patch('/createAdmin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.get('/checkAdmin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })
// ffffffffff

        app.post('/meals', async (req, res) => {
            const item = req.body;
            const result = await mealsCollection.insertOne(item);
            res.send(result);
        });
        app.post('/upComingToMeals', async (req, res) => {
            const item = req.body;
            const result = await mealsCollection.insertOne(item);
            res.send(result);
        });
        app.post('/upComingMeals', async (req, res) => {
            const item = req.body;
            const result = await upComingMealsCollection.insertOne(item);
            res.send(result);
        });

        app.delete("/meals/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollection.deleteOne(query);
            res.send(result);
        });
        app.delete("/upComingMeals/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await upComingMealsCollection.deleteOne(query);
            res.send(result);
        });


        app.patch('/updateMeals/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    mealTitle: item.mealTitle,
                    mealType: item.mealType,
                    price: item.price,
                    rating: item.rating,
                    ingredients: item.ingredients,
                    mealImage: item.mealImage, 
                    adminName: item.adminName,
                    adminEmail: item.adminEmail,
                }
            }

            const result = await mealsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })
        app.patch('/updateStatus/:id', async (req, res) => {            
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                  status:'delivered'
                }
            }

            const result = await requestedMealsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })
        
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);

// Root Api to check activity
app.get("/", (req, res) => {
    res.send("Assignment-12 is  running!!!");
});
app.listen(port, () => {
    console.log(` listening on port ${port}`);
});