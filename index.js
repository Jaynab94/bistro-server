require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

var jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
app.port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());





const corsOptions = {

    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://bistro-boss-e1daa.web.app',
        'https://bistro-boss-e1daa.firebaseapp.com'



    ],
    credentials: true,
    optionSuccessStatus: 200,
}



//mongodb connection


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uo3rphs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        // await client.connect();



        const menuCollection = client.db("bistroDB").collection("menu");
        const userCollection = client.db("bistroDB").collection("users");
        const reviewsCollection = client.db("bistroDB").collection("reviews");
        const cartsCollection = client.db("bistroDB").collection("carts");
        const paymentsCollection = client.db("bistroDB").collection("payments");

        //create web token api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token: token });
        })


        //middle were verify token
        const verifyToken = (req, res, next) => {
            console.log('inside verrify token', req.headers.authorization)
            if (!req.headers.authorization) {
                res.status(401).send({ message: 'Forbidden access' })
                return;
            }

            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                res.status(401).send({ message: 'Forbidden access' })
                return;
            }
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    res.status(401).send({ message: 'Forbidden access' })
                    return;

                }

                req.decoded = decoded;
                next();

            })


        }

        //verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Unauthorized access' });

            }
            next();


        }





        //admin api for dashboard access
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                req.status(403).send({ message: 'Unauthorized access' });

            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })


        });



        //users related api get all users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const paymentResult = await userCollection.find().toArray();
            res.send(result);
        });

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const deletedResult = await userCollection.deleteOne(query)
            res.send({ paymentResult, deletedResult });
        });




        //admin related api[change user role to admin]

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {

                    role: 'admin'
                }
            }

            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result);

        });


        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exists", insertedId: null });
            }

            const result = await userCollection.insertOne(user);
            console.log(result);
            res.send(result);
        });


        //get menu data
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        });

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query)
            res.send(result);
        });

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollection.insertOne(menu);
            res.send(result);
        });

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            console.log(query);
            const result = await menuCollection.deleteOne(query);
            console.log(result);
            res.send(result);

        });

        app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    recipe: item.recipe,
                    price: item.price,
                    image: item.image

                }
            }
            const result = await menuCollection.updateOne(filter, updatedDoc);
            res.send(result);

        });



        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);

        });



        // carts data post 

        app.get('/carts', async (req, res) => {

            const email = req.query.email;

            const query = { email: email };
            console.log(email);
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/carts', async (req, res) => {
            const cart = req.body;
            const result = await cartsCollection.insertOne(cart);
            res.json(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        });

        // create payment intent

        app.post('/create_payment_intent', async (req, res) => {

            const { price } = req.body;

            // const amount = 100;
            // const amount = parseInt(price * 100);
            const amount = parseInt(price * 100);
            console.log(amount);



            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],

            });

            res.send({
                client_secret: paymentIntent.client_secret
            });
            console.log(paymentIntent.client_secret);



        });

        //payment related api
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            console.log(payment, 'info pyment');
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }

            }

            const deletedResult = await cartsCollection.deleteMany(query);
            res.send({ result });
        });

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            console.log(query);
            if (req.params.email !== req.decoded.email) {

                return res.status(403).send({ message: 'Unauthorized access' });
            }
            const result = await paymentsCollection.find(query).toArray();
            console.log(result);
            res.send(result);
        });


        app.get('/payments', async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            console.log(result);
            res.send(result);
        })


        // analytics related api
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentsCollection.estimatedDocumentCount();

            const result = await paymentsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'

                        }

                    }
                },
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;
            res.send(
                {
                    users,
                    menuItems,
                    orders,
                    revenue


                }
            );

        })


        //for bar chart and pie chart

        app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentsCollection.aggregate([

                {
                    $unwind: "$menuIds",
                },
                {
                    $addFields: {
                        menuId: { $toObjectId: "$menuIds" },
                    },
                },
                {
                    $lookup: {
                        from: "menu",
                        localField: "menuId",
                        foreignField: "_id",
                        as: "menuItems",
                    },
                },
                {
                    $unwind: '$menuItems',
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: {
                            $sum: 1,

                        },
                        revenue: {
                            $sum: '$menuItems.price'
                        }


                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue',

                    }
                }

            ]).toArray();

            res.send(result);
        })






        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Bistro hotel resturent server running');
})

app.listen(app.port, () => {
    console.log(`Bistro Boss server is running on port ${app.port}`); ``
})