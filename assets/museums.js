// Pilot directory: Smithsonian museum institutions in Washington, DC.
// Names, descriptions, addresses, and official links are based on Smithsonian visitor pages.
const commonsPhoto = (filename, author, licenseLabel, licenseUrl) => ({
  photo: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900`,
  photoCredit: author,
  photoSource: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/ /g, "_"))}`,
  photoLicense: licenseUrl,
  photoLicenseLabel: licenseLabel
});

window.MUSEUMS = [
  {
    id: "african-american-history",
    name: "National Museum of African American History and Culture",
    shortName: "African American History & Culture",
    category: "History & culture",
    area: "National Mall",
    address: "1400 Constitution Ave. NW, Washington, DC",
    description: "Explore African American history and culture through stories, objects, and the people who shaped the nation.",
    officialUrl: "https://www.si.edu/museums/african-american-museum",
    icon: "✳", monogram: "AA", accent: "coral",
    ...commonsPhoto("National Museum of African American History and Culture 2019.jpg", "Difference engine", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
  },
  {
    id: "american-history",
    name: "National Museum of American History",
    shortName: "American History",
    category: "History & culture",
    area: "National Mall",
    address: "1300 Constitution Ave. NW, Washington, DC",
    description: "Follow the scientific, cultural, social, technological, and political stories of the United States.",
    officialUrl: "https://www.si.edu/museums/american-history-museum",
    icon: "✶", monogram: "AH", accent: "gold",
    ...commonsPhoto("National Museum of American History 1.jpg", "G. Edward Johnson", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/")
  },
  {
    id: "natural-history",
    name: "National Museum of Natural History",
    shortName: "Natural History",
    category: "Science & nature",
    area: "National Mall",
    address: "10th St. & Constitution Ave. NW, Washington, DC",
    description: "Explore the natural world and our place in it, from ancient life to the diversity of the living planet.",
    officialUrl: "https://www.si.edu/museums/natural-history-museum",
    icon: "◉", monogram: "NH", accent: "moss",
    ...commonsPhoto("Smithsonian National Museum of Natural History - facade view.jpg", "Ryan Schwark", "CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/")
  },
  {
    id: "american-indian",
    name: "National Museum of the American Indian",
    shortName: "American Indian",
    category: "History & culture",
    area: "National Mall",
    address: "4th St. & Independence Ave. SW, Washington, DC",
    description: "Encounter the histories, cultures, and voices of Native peoples across the Western Hemisphere.",
    officialUrl: "https://www.si.edu/museums/american-indian-museum",
    icon: "✧", monogram: "AI", accent: "clay",
    ...commonsPhoto("National Museum of the American Indian 3.jpg", "Kurt Kaiser", "CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/")
  },
  {
    id: "air-and-space",
    name: "National Air and Space Museum",
    shortName: "Air and Space",
    category: "Science & technology",
    area: "National Mall",
    address: "650 Jefferson Dr. SW, Washington, DC",
    description: "Get close to the aircraft, spacecraft, and ideas that changed how we see the sky and beyond.",
    officialUrl: "https://www.si.edu/museums/air-and-space-museum",
    icon: "✈", monogram: "AS", accent: "blue",
    ...commonsPhoto("National Air and Space Museum on Independence Ave SW - Washington DC.jpg", "Tim Evanson", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/")
  },
  {
    id: "hirshhorn",
    name: "Hirshhorn Museum and Sculpture Garden",
    shortName: "Hirshhorn",
    category: "Art & design",
    area: "National Mall",
    address: "Independence Ave. at 7th St. SW, Washington, DC",
    description: "Meet modern and contemporary art in a landmark circular museum and its sculpture garden.",
    officialUrl: "https://www.si.edu/museums/hirshhorn-museum-and-sculpture-garden",
    icon: "◌", monogram: "HI", accent: "plum",
    ...commonsPhoto("Hirshhorn Museum DC 2007 010.jpg", "Gryffindor", "Public domain", "https://creativecommons.org/publicdomain/mark/1.0/")
  },
  {
    id: "african-art",
    name: "National Museum of African Art",
    shortName: "African Art",
    category: "Art & design",
    area: "National Mall",
    address: "950 Independence Ave. SW, Washington, DC",
    description: "Discover traditional and contemporary art from across the African continent.",
    officialUrl: "https://www.si.edu/museums/african-art-museum",
    icon: "❋", monogram: "AF", accent: "terracotta",
    ...commonsPhoto("National Musuem of African Art.jpg", "Minette Lontsie", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
  },
  {
    id: "asian-art",
    name: "National Museum of Asian Art",
    shortName: "Asian Art",
    category: "Art & design",
    area: "National Mall",
    address: "1050 Independence Ave. SW, Washington, DC",
    description: "Travel across Asia through art spanning thousands of years and many cultures.",
    officialUrl: "https://asia.si.edu/",
    icon: "◈", monogram: "AA", accent: "jade",
    ...commonsPhoto("Freer Gallery of Art - National Museum of Asian Art (53832136335).jpg", "ajay_suresh", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/")
  },
  {
    id: "american-art",
    name: "Smithsonian American Art Museum",
    shortName: "American Art",
    category: "Art & design",
    area: "Penn Quarter",
    address: "8th and G Streets NW, Washington, DC",
    description: "See the many ways artists have pictured life in America, from early works to the present.",
    officialUrl: "https://americanart.si.edu/visit/saam",
    icon: "▧", monogram: "SA", accent: "rose",
    ...commonsPhoto("Smithsonian American Art Museum exterior.jpg", "Zack Frank", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/")
  },
  {
    id: "portrait-gallery",
    name: "National Portrait Gallery",
    shortName: "Portrait Gallery",
    category: "Art & history",
    area: "Penn Quarter",
    address: "8th and G Streets NW, Washington, DC",
    description: "Meet the people who have shaped the country through portraiture, performance, and biography.",
    officialUrl: "https://www.si.edu/museums/portrait-gallery",
    icon: "◍", monogram: "PG", accent: "navy",
    ...commonsPhoto("Smithsonian American Art Museum exterior building.jpg", "Frogvixen", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
  },
  {
    id: "postal",
    name: "National Postal Museum",
    shortName: "Postal Museum",
    category: "History & culture",
    area: "NoMa",
    address: "2 Massachusetts Ave. NE, Washington, DC",
    description: "Trace the history of mail, stamps, and the people and vehicles that carried messages across the country.",
    officialUrl: "https://www.si.edu/museums/postal-museum",
    icon: "✉", monogram: "PM", accent: "blue",
    ...commonsPhoto("National postal museum.jpg", "Kmf164", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/")
  },
  {
    id: "anacostia",
    name: "Anacostia Community Museum",
    shortName: "Anacostia Community",
    category: "History & culture",
    area: "Anacostia",
    address: "1901 Fort Place SE, Washington, DC",
    description: "Explore the histories and contemporary experiences of urban communities, especially in Washington, DC.",
    officialUrl: "https://www.si.edu/museums/anacostia-community-museum",
    icon: "⌂", monogram: "AC", accent: "moss",
    ...commonsPhoto("Anacostia Museum Building.jpg", "Smithsonian Institution Archives", "Usage terms", "https://siarchives.si.edu/collections/siris_sic_7120")
  },
  {
    id: "national-zoo",
    name: "Smithsonian's National Zoo and Conservation Biology Institute",
    shortName: "Smithsonian Zoo",
    category: "Science & nature",
    area: "Woodley Park",
    address: "3001 Connecticut Ave. NW, Washington, DC 20011",
    description: "Meet wildlife and learn how the Zoo works to protect species and care for animals.",
    officialUrl: "https://nationalzoo.si.edu/visit",
    icon: "✿", monogram: "NZ", accent: "moss",
    ...commonsPhoto("Bao Li.jpg", "Melina Kolburn", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
  }
];
