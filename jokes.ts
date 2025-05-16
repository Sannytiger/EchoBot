/**
 * Joke service for the Discord bot
 * Fetches random jokes from public APIs
 */

import fetch from 'node-fetch';

// Define joke interface
interface Joke {
  setup?: string;
  delivery?: string;
  joke?: string;
  punchline?: string;
}

// Define JokeAPI response types
interface JokeApiSingleResponse {
  type: 'single';
  joke: string;
  id: number;
  error: boolean;
  category: string;
  flags: Record<string, boolean>;
  safe: boolean;
  lang: string;
}

interface JokeApiTwoPartResponse {
  type: 'twopart';
  setup: string;
  delivery: string;
  id: number;
  error: boolean;
  category: string;
  flags: Record<string, boolean>;
  safe: boolean;
  lang: string;
}

type JokeApiResponse = JokeApiSingleResponse | JokeApiTwoPartResponse;

/**
 * Fetches a random joke from the JokeAPI
 * @returns A promise that resolves to a joke string
 */
export async function getRandomJoke(): Promise<string> {
  try {
    // Using JokeAPI - a free and open API for jokes
    const response = await fetch('https://v2.jokeapi.dev/joke/Programming,Miscellaneous,Pun?safe-mode&type=single,twopart');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch joke: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as JokeApiResponse;
    
    // Format the joke based on type
    if (data.type === 'single') {
      return data.joke;
    } else if (data.type === 'twopart') {
      return `${data.setup}\n\n${data.delivery}`;
    } else {
      return "I tried to tell a joke, but I couldn't remember the punchline!";
    }
  } catch (error) {
    console.error('Error fetching joke:', error);
    // Return a fallback joke if API fails
    return "Why did the developer go broke? Because they lost their domain in a crash!";
  }
}

/**
 * Alternative joke sources in case main API is down
 */
export async function getFallbackJoke(): Promise<string> {
  const fallbackJokes = [
    "Why do programmers prefer dark mode? Because light attracts bugs!",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem!",
    "Why do Java developers wear glasses? Because they don't C#!",
    "What's a programmer's favorite hangout spot? The Foo Bar!",
    "Why did the functions stop calling each other? They had too many arguments!",
    "What's the object-oriented way to become wealthy? Inheritance!",
    "Why was the JavaScript developer sad? Because they didn't Node how to Express themselves!",
    "Why did the developer go broke? Because they lost their domain in a crash!",
    "What's a developer's favorite tea? Proper-tea!",
    "Why did the programmer quit their job? They didn't get arrays!"
  ];
  
  // Pick a random joke from the array
  const randomIndex = Math.floor(Math.random() * fallbackJokes.length);
  return fallbackJokes[randomIndex];
}
