// Celebrity names for demo orders - using famous personalities
export const CELEBRITY_NAMES = [
  { firstName: "Taylor", lastName: "Swift" },
  { firstName: "Leonardo", lastName: "DiCaprio" },
  { firstName: "Oprah", lastName: "Winfrey" },
  { firstName: "Robert", lastName: "Downey Jr" },
  { firstName: "Jennifer", lastName: "Lawrence" },
  { firstName: "Will", lastName: "Smith" },
  { firstName: "Emma", lastName: "Stone" },
  { firstName: "Ryan", lastName: "Reynolds" },
  { firstName: "Scarlett", lastName: "Johansson" },
  { firstName: "Chris", lastName: "Hemsworth" },
  { firstName: "Angelina", lastName: "Jolie" },
  { firstName: "Brad", lastName: "Pitt" },
  { firstName: "Tom", lastName: "Hanks" },
  { firstName: "Meryl", lastName: "Streep" },
  { firstName: "Morgan", lastName: "Freeman" },
  { firstName: "Sandra", lastName: "Bullock" },
  { firstName: "Denzel", lastName: "Washington" },
  { firstName: "Julia", lastName: "Roberts" },
  { firstName: "Johnny", lastName: "Depp" },
  { firstName: "Matt", lastName: "Damon" },
  { firstName: "Ben", lastName: "Affleck" },
  { firstName: "Jennifer", lastName: "Aniston" },
  { firstName: "George", lastName: "Clooney" },
  { firstName: "Reese", lastName: "Witherspoon" },
  { firstName: "Mark", lastName: "Wahlberg" },
  { firstName: "Amy", lastName: "Adams" },
  { firstName: "Ryan", lastName: "Gosling" },
  { firstName: "Anne", lastName: "Hathaway" },
  { firstName: "Christian", lastName: "Bale" },
  { firstName: "Natalie", lastName: "Portman" },
]

// Get a celebrity name by index (cycles through the list)
export function getCelebrityName(index: number): { firstName: string; lastName: string } {
  return CELEBRITY_NAMES[index % CELEBRITY_NAMES.length]
}

// Get multiple celebrity names
export function getCelebrityNames(count: number): Array<{ firstName: string; lastName: string }> {
  const names = []
  for (let i = 0; i < count; i++) {
    names.push(getCelebrityName(i))
  }
  return names
}
