import axios from "axios";

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// Picks 2 random, different letters (e.g. "b" and "p") every time
// this function runs, and returns the meals for just those letters.
// This keeps the "all meals" endpoint fast and gives a fresh mix
// on each request, instead of hitting all 26 letters every time.
export const getAllMeals = async () => {
    const shuffled = [...ALPHABET].sort(() => 0.5 - Math.random());
    const randomLetters = shuffled.slice(0, 2);

    const requests = randomLetters.map((letter) =>
        axios.get(`${BASE_URL}/search.php`, { params: { f: letter } })
    );

    const responses = await Promise.all(requests);

    let meals: any[] = [];
    responses.forEach((response) => {
        if (response.data.meals) {
            meals = meals.concat(response.data.meals);
        }
    });

    return meals;
};

// Fetches one meal by its TheMealDB id.
export const getMealById = async (id: string) => {
    const response = await axios.get(`${BASE_URL}/lookup.php`, {
        params: { i: id },
    });

    const meals = response.data.meals;
    return meals ? meals[0] : null;
};

// Searches meals by name.
export const searchMeal = async (name: string) => {
    const response = await axios.get(`${BASE_URL}/search.php`, {
        params: { s: name },
    });

    return response.data.meals || [];
};

// Fetches the list of all meal categories.
export const getAllCat = async () => {
    const response = await axios.get(`${BASE_URL}/categories.php`);
    return response.data.categories || [];
};

// Fetches meals belonging to a specific category.
export const getMealByCat = async (category: string) => {
    const response = await axios.get(`${BASE_URL}/filter.php`, {
        params: { c: category },
    });

    return response.data.meals || [];
};
