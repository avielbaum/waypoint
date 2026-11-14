// The four regions of the world map. Each has an anchor city, where a Rift Site waits in Act III (see story.js), and a list
// of places it covers. Any real place can still be visited: one that is not listed belongs to "the Margins", which has no
// site. Pure data, tested by check.mjs.

export const REGIONS = {
  pacific: {
    name: "The Pacific Rim", anchor: "Kyoto", ally: "Sora",
    blurb: "Lantern streets, harbours and temples from Japan to Australia.",
    places: ["Kyoto", "Tokyo", "Osaka", "Seoul", "Beijing", "Shanghai", "Hong Kong", "Taipei", "Hanoi", "Bangkok", "Singapore", "Manila", "Jakarta", "Bali", "Sydney", "Melbourne", "Auckland", "Mumbai", "Delhi"],
  },
  europe: {
    name: "Old Europe", anchor: "Lisbon", ally: "Ilse",
    blurb: "Squares, rivers and cold northern coasts.",
    places: ["Lisbon", "Madrid", "Barcelona", "Paris", "London", "Dublin", "Amsterdam", "Berlin", "Prague", "Vienna", "Rome", "Venice", "Athens", "Istanbul", "Oslo", "Stockholm", "Reykjavik", "Warsaw", "Moscow"],
  },
  sahara: {
    name: "Africa and the Gulf", anchor: "Cairo", ally: "Oluwa",
    blurb: "Markets, deserts and a very long coast.",
    places: ["Cairo", "Marrakech", "Tunis", "Lagos", "Accra", "Nairobi", "Addis Ababa", "Zanzibar", "Cape Town", "Johannesburg", "Dakar", "Dubai", "Doha", "Petra", "Tehran", "Jerusalem"],
  },
  americas: {
    name: "The Americas", anchor: "Mexico City", ally: "Vesper",
    blurb: "Mountains, jungle, big rivers and bigger cities.",
    places: ["Mexico City", "Havana", "New Orleans", "New York", "San Francisco", "Chicago", "Toronto", "Vancouver", "Lima", "Cusco", "Bogota", "Rio de Janeiro", "Buenos Aires", "Santiago", "Quito", "Honolulu"],
  },
};
export const REGION_IDS = Object.keys(REGIONS);

export const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const lookup = new Map(REGION_IDS.flatMap(id => REGIONS[id].places.map(p => [norm(p), id])));

/** The region id a place is in, or null (the Margins). Case and accents do not matter. */
export const regionOf = dest => lookup.get(norm(dest)) || null;
/** The anchor city's region id if dest is an anchor, else null. */
export const anchorOf = dest => REGION_IDS.find(id => norm(REGIONS[id].anchor) === norm(String(dest).split(",")[0])) || null;
