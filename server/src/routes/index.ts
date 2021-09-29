import { Router } from 'express';
import {categories} from "../util/constants";
import {Room, rooms} from "@daos/rooms";
import db from '@daos/db';

// Init router and path
const router = Router();

router.get("/rooms", (req, res) => {
    res.json(Object.keys(rooms))
})

router.get("/categories", (req, res) => {
    res.json(categories)
})

router.post("/create-room", (req, res) => {
    if(req.body.name in rooms) {
        res.json({success: false})
    }
    else {
        let query = ""

        for(const category of categories) {
            if(req.body[category] !== undefined) {
                switch (category) {
                    case "champions":
                    case "spells":
                    case "skins":
                        query += `SELECT '${category}' AS category, id FROM ${category} UNION `
                        break;
                    case "items":
                        query += `
                    SELECT '${category}' AS category, id
                    FROM items
                    WHERE EXISTS
                    (SELECT * FROM item_maps JOIN maps ON maps.id = item_maps.map
                     WHERE item_maps.item = items.id AND maps.name = 'Summoner''s Rift') UNION `
                        break;
                }
            }
        }
        db.any(query.substring(0, query.length - 7) + ";").then(result => {
            rooms[req.body.name] = new Room(
                req.body.name,
                req.body.password,
                result,
                req.body.time
            );
            res.json({success: true})
        }).catch(console.log);
    }
})

// Export the base-router
export default router;
