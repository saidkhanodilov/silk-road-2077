// The stops on the Silk Road 2077. Each city links its famous scientist to something I built.

export const STATIONS = [
  {
    id: 'chelak',
    name: 'Chelak',
    color: 0xffbe55,
    era: 'ORIGIN',
    tagline: 'Samarkand Region · small town, big uptime',
    then: 'A small town in the Samarkand Region, and the place where my story starts.',
    now: 'In high school I built websites for local educational centers, worked directly with their owners, and kept the sites running on AWS EC2. Later I got an official license from TED and organized TEDxChelak Youth for young people in my town.',
    meme: 'Freelancing lesson #1: "Can you make the logo bigger?" is never really a question.',
    link: { href: '#experience', label: 'See my experience' },
  },
  {
    id: 'samarkand',
    name: 'Samarkand',
    color: 0x2fe6d0,
    era: 'STARGAZERS',
    tagline: 'Registan · Ulugh Beg Observatory',
    then: 'In the 1420s Ulugh Beg built a giant observatory here and catalogued about a thousand stars, long before anyone pointed a telescope at the sky.',
    now: 'Six hundred years later I wrote SimulateUz: a C++17 physics engine with RK4 integration that flies a rocket from Baikonur to a 400 km orbit, rendered live in Java with OpenGL.',
    meme: 'Ulugh Beg: maps a thousand stars by hand. Me: one wrong minus sign and my rocket tunnels into the Earth\'s core.',
    link: { href: '#mission-simulateuz', label: 'Open the SimulateUz mission' },
  },
  {
    id: 'bukhara',
    name: 'Bukhara',
    color: 0x7d95ff,
    era: 'LIBRARIES',
    tagline: 'Kalyan Minaret · Samanid royal library',
    then: 'Bukhara was a city of libraries. As a teenager, Ibn Sina was allowed into the Samanid royal library here and read his way to becoming one of history\'s greatest scholars.',
    now: 'LearnForFree is my version of an open library: teachers publish courses and quizzes, and learners follow paths for free. 63 REST endpoints, Spring Security, and a C++ inspector that checks every upload.',
    meme: 'Ibn Sina wrote a medical encyclopedia. I wrote 46 JUnit tests. We both prevent suffering.',
    link: { href: '#mission-learnforfree', label: 'Open the LearnForFree mission' },
  },
  {
    id: 'khiva',
    name: 'Khiva',
    color: 0xff4fd2,
    era: 'ALGORITHMS',
    tagline: 'Itchan Kala · Kalta Minor',
    then: 'Al-Khwarizmi came from Khwarazm, the region around Khiva. The word "algorithm" comes from his name, and "algebra" from the title of his book.',
    now: 'I keep his legacy busy: 297 Codeforces problems solved in Java so far, practicing algorithms and data structures one verdict at a time.',
    meme: 'Al-Khwarizmi: invents algebra. Me: "Wrong answer on test 2."',
    link: { href: '#mission-codeforces', label: 'See my Codeforces practice' },
  },
  {
    id: 'tashkent',
    name: 'Tashkent',
    color: 0x3ee8ff,
    era: 'HOME BASE',
    tagline: 'Capital of Uzbekistan · biggest city in Central Asia',
    then: 'Uzbekistan\'s capital and the largest city in Central Asia. It\'s where I live and study today.',
    now: 'I study Computer Science at Central Asian University and lead the campus AWS Student Builder Group, running hands-on cloud workshops for students.',
    meme: 'Rule #1 of my AWS workshops: set up a billing alarm. Rule #2: see rule #1.',
    link: { href: '#about', label: 'Read my story' },
  },
  {
    id: 'cloud',
    name: 'The Cloud',
    color: 0xc8f4ff,
    era: 'FINAL DESTINATION',
    tagline: 'Region: everywhere · latency: low',
    then: 'This site is served from the AWS cloud by Amplify Hosting, through a global CDN.',
    now: 'Next stop: your team. I\'m looking for internships and trainee roles in software engineering.',
    meme: 'There is no cloud. It\'s just someone else\'s computer. Thanks for lending me yours, AWS.',
    link: { href: '#contact', label: 'Open a comms channel' },
  },
];

export const BUG_MESSAGES = [
  'NullPointerException!',
  'StackOverflowError!',
  'ConcurrentModificationException!',
  'ArrayIndexOutOfBoundsException!',
  'Segmentation fault (core dumped)',
  'It worked yesterday!',
  'Works on my machine?!',
  'Merge conflict!',
  'Missing semicolon;',
];

export const BEAN_MESSAGES = [
  '+1 Java bean',
  'JVM warming up…',
  'Caffeine level: rising',
  'Coffee → Code',
  'Compiling…',
  'Garbage collector says thanks',
];

export function rankFor(beans, bugs) {
  let rank = 'Intern (unpaid, but happy)';
  if (beans >= 80) rank = 'Senior Bean Engineer';
  else if (beans >= 50) rank = 'Mid-level Caravan Pilot';
  else if (beans >= 20) rank = 'Junior Camel Whisperer';
  if (bugs >= 8) rank += ', with a large bug collection';
  else if (bugs === 0) rank += ', zero bugs (suspicious)';
  return rank;
}
