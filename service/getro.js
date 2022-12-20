import fetch from "node-fetch";

// constants used in the file
// const GETRO_ID = process.env.GETRO_ID:
// const GETRO_EMAIL = process.env.GETRO_EMAIL;
// const GETRO_TOKEN = process.env.GETRO_TOKEN;

// Function to get jobs from getro
const fetchDataFromGetro = async (page, sponsorNames) => {
  const GETRO_ID = process.env.GETRO_ID;
  try {
    const url = `https://api.getro.com/v2/networks/${GETRO_ID}/jobs?per_page=100&page=${page}&companies=${sponsorNames}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ["X-User-Email"]: process.env.GETRO_EMAIL,
        ["X-User-Token"]: process.env.GETRO_TOKEN,
      },
    });

    const json = await response.json();
    const totalJobs = json?.meta?.total ?? 0;

    return [totalJobs, json?.items ?? []];
  } catch (error) {
    console.log(error);
    console.log(error.stack);
    return [0, []];
  }
};

// Fetch all jobs from getro
export const getAllGetroJobs = async (sponsorNames) => {
  const allJobs = [];
  const [totalJobs, jobs] = await fetchDataFromGetro(1, sponsorNames);
  allJobs.push(...jobs);

  if (totalJobs > 100) {
    // if there are more than 100 jobs
    for (let i = 2; i < Math.ceil(totalJobs / 100); i++) {
      const [_, jobs] = await fetchDataFromGetro(i, sponsorNames);
      allJobs.push(...jobs);
    }
  }

  return allJobs;
};
