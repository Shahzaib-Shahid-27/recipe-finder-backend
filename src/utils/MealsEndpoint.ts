export const endpoints = [
    "/search.php", // to directly search the meal
    "/search.php", // to get meals by randaom a-z alphabet
    "/lookup.php", // to get meal by id
    "/categories.php", // get all categories
    "/filter.php" // to get meals by category
];


// To get full view how to search what 
// 1. GET /search.php?s={mealName}

// 2. GET /search.php?f={letter}

// 3. GET /lookup.php?i={mealId}

// 4. GET /categories.php

// 5. GET /filter.php?c={category}