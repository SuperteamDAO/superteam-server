import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

import _ from "lodash";
import algoliasearch from "algoliasearch";
import fetch from "node-fetch";

import { getAllGetroJobs } from "../service/getro.js";
import { print, printToSlack } from "./log.js";
import {
  Airtable,
  BASE_ID,
  SKILLS_STRUCTURE,
  SPONSORS_STRUCTURE,
  JOBS_STRUCTURE,
  getSkillsMap,
  getSponsorsMap,
  getAirtableRecords,
} from "./airtable.js";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV = process.env.CLOUDFLARE_KV_NAMESPACE_SUPERTEAM_EARN;

const algoliaClient = algoliasearch(
  process.env.ALGOLIA_APPLICATION_ID,
  process.env.ALGOLIA_ADMIN_KEY
);

const GETRO_SKILL_MAP = {
  "Software Engineering": "Front-End Dev",
  "Other Engineering": "Back-End Dev",
  "Data Science": "Back-End Dev",
  IT: "Back-End Dev",
  "Marketing & Communications": "Growth",
  Product: "Growth",
  Design: "Design",
  Content: "Content",
  Administration: "Other",
  [SKILLS_STRUCTURE.defaultSkill]: "Other",
};

function mapGetroSkill(skillsMap, defaultSkill, name, skills) {
  const functions = new Set();
  const normalizedName = name.toLowerCase();

  if (normalizedName.match(/content|vfx|artist/i)) {
    functions.add(skillsMap["Content"]?.recordId ?? defaultSkill);
  }

  if (normalizedName.match(/contract|solidity|rust|blockchain/i)) {
    functions.add(skillsMap["Blockchain Dev"]?.recordId ?? defaultSkill);
  }

  if (
    normalizedName.match(
      /infrastructure|devops|qa|android|back-end|engineer|reliability|software|dev ops/i
    )
  ) {
    functions.add(skillsMap["Back-End Dev"]?.recordId ?? defaultSkill);
  }

  if (normalizedName.match(/full stack|fullstack|backend|full-stack/i)) {
    functions.add(skillsMap["Back-End Dev"]?.recordId ?? defaultSkill);
  }

  skills.forEach((skill) => {
    const parsedSkill =
      skillsMap[GETRO_SKILL_MAP[skill.trim()]]?.recordId ?? defaultSkill;
    functions.add(parsedSkill);
  });

  if (functions.size === 0) {
    return [defaultSkill];
  }

  return Array.from(functions);
}

async function updateAlgoliaIndex(records) {
  const indexId = process.env.ALGOLIA_INDEX_NAME;

  try {
    // Update the algolia index
    const index = algoliaClient.initIndex(indexId);
    await index.clearObjects();
    await index.saveObjects(records);
    print("Written Algolia Opportunities Index");
  } catch (error) {
    await printToSlack(error);
    await printToSlack(error.stack);
  }
}

// Update cloudflare index of items
export async function updateClouflareIndex(records) {
  try {
    if (!records) {
      print("Fetching records from Airtable");
      [records] = await getAirtableRecords();
    } else {
      print("Not fetching records from Airtable");
    }

    const url = `${process.env.CLOUDFLARE_URL}`;
    const bounties = records.filter((record) => record.type === "Bounties");
    const grants = records.filter((record) => record.type === "Grants");
    const jobs = records.filter((record) => record.type === "Jobs");

    const featuredJobs = jobs.filter((job) => job.featured);
    const normalJobs = jobs.filter((job) => !job.featured);

    const featuredGrants = grants.filter((grant) => grant.featured);
    const normalGrants = grants.filter((grant) => !grant.featured);

    const featuredBounties = bounties.filter((bounty) => bounty.featured);
    const normalBounties = bounties.filter((bounty) => !bounty.featured);

    // featured opportunities should be first
    const allJobs = [..._.shuffle(featuredJobs), ..._.shuffle(normalJobs)];
    const allBounties = [
      ..._.shuffle(featuredBounties),
      ..._.shuffle(normalBounties),
    ];
    const allGrants = [
      ..._.shuffle(featuredGrants),
      ..._.shuffle(normalGrants),
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ["AUTH_TOKEN"]: process.env.AUTH_TOKEN,
      },
      body: JSON.stringify({
        keepalive: "keepalive",
        jobs: allJobs,
        bounties: allBounties,
        grants: allGrants,
        main: {
          jobs: allJobs.slice(0, 50),
          bounties: allBounties,
          grants: allGrants,
        },
      }),
    });

    print("Written Cloudflare Index");
    const json = await response.text();
    print(json);

    // Now update individual keys
    const allItems = [];
    const sponsorMap = {};

    // Iterate over all keys
    [...jobs, ...bounties, ...grants].forEach((item) => {
      allItems.push({
        key: item.objectID,
        value: JSON.stringify(item),
        expiration_ttl: 36000,
      });

      if (item.type !== "Jobs") {
        const sponsorName = item.sponsorName.replace(/ /g, "").toLowerCase();
        if (sponsorMap[item.sponsorName]) {
          sponsorMap[sponsorName].push(item);
        } else {
          sponsorMap[sponsorName] = [item];
        }
      }
    });

    // Push all sponsorKeys
    for (const [key, value] of Object.entries(sponsorMap)) {
      allItems.push({
        key,
        value: JSON.stringify(value),
        expiration_ttl: 36000,
      });
    }

    const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV}/bulk`;
    const kvResponse = await fetch(kvUrl, {
      method: "PUT",
      headers: {
        ["Authorization"]: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
        ["Content-Type"]: "application/json",
      },
      body: JSON.stringify(allItems),
    });
    print("Written Cloudflare Keys");
    const kvText = await kvResponse.text();
    print(kvText);
  } catch (error) {
    await printToSlack(error);
    await printToSlack(error.stack);
  }
}

// Update coingecko index
async function updateCoingeckoIndex() {
  try {
    const coingeckoResult = await fetch(
      "https://api.coingecko.com/api/v3/coins/list"
    );
    const coingeckoList = await coingeckoResult.json();

    const url = `${process.env.CLOUDFLARE_URL}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ["AUTH_TOKEN"]: process.env.AUTH_TOKEN,
      },
      body: JSON.stringify({
        coingeckoList: coingeckoList,
        coingeckoListTime: Date.now() / 1000,
      }),
    });

    const json = await response.text();
    print(json);
  } catch (error) {
    print(error);
    print(error.stack);
  }
}

// Update the algolia index
export async function updateIndex() {
  try {
    const [records] = await getAirtableRecords();

    // Update cloudflare index next
    await updateClouflareIndex(records);

    // Update algolia index first
    await updateAlgoliaIndex(records);

    // Update coingecko list
    await updateCoingeckoIndex();

    return [true, "Updated"];
  } catch (error) {
    await printToSlack(error);
    await printToSlack(error.stack);
    return [false, "Error"];
  }
}

// get all jobs from getro
export async function updateGetroJobs() {
  // Get a list of all our sponsors
  const sponsorsMap = await getSponsorsMap();

  // Create a mapping of sponsor name to id
  const sponsorNameMap = {};
  for (const record of Object.values(sponsorsMap)) {
    const sponsorName = record?.[SPONSORS_STRUCTURE.schema.name] ?? "";
    if (sponsorName) {
      sponsorNameMap[sponsorName.toLowerCase()] = record;
    }
  }

  // get the mapping of skills to ids
  const skillsMap = await getSkillsMap();

  try {
    const sponsorNames = Object.keys(sponsorNameMap).join("|");
    const allJobs = await getAllGetroJobs(sponsorNames);

    if (allJobs.length === 0) {
      await printToSlack("No jobs found from getro");
      return [true, "No jobs found from getro"];
    }

    const defaultSkill = skillsMap[SKILLS_STRUCTURE.defaultSkill].recordId;

    const getroRecords = allJobs.map((job) => {
      try {
        const data = {
          [JOBS_STRUCTURE.schema.source]: "Getro",
          [JOBS_STRUCTURE.schema.externalId]: `${job.id}`,
          [JOBS_STRUCTURE.schema.name]: job.title,
          [JOBS_STRUCTURE.schema.description]:
            sponsorNameMap[job.company.name.toLowerCase().trim()][
              SPONSORS_STRUCTURE.schema.description
            ],
          [JOBS_STRUCTURE.schema.url]: job.url,
          [JOBS_STRUCTURE.schema.sponsor]: [
            sponsorNameMap[job.company.name.toLowerCase().trim()].recordId,
          ],
          [JOBS_STRUCTURE.schema.location]: job.locations.join(","),
        };

        if (job.job_functions.length > 0) {
          data[JOBS_STRUCTURE.schema.skill] = mapGetroSkill(
            skillsMap,
            defaultSkill,
            job.title,
            job.job_functions
          );
        } else {
          data[JOBS_STRUCTURE.schema.skill] = mapGetroSkill(
            skillsMap,
            defaultSkill,
            job.title,
            []
          );
        }

        // Remove skills which are duplicate
        data[JOBS_STRUCTURE.schema.skill] = [
          ...new Set(data[JOBS_STRUCTURE.schema.skill]),
        ];

        return data;
      } catch (error) {
        print(job);
        print(error);
      }
    });

    // Get existing jobs from airtable
    const base = Airtable.base(BASE_ID);
    const [existingAirtableRecords, duplicateRecords] =
      await getAirtableRecords();

    // Figure out getro jobs which are already in airtable
    const existingGetroAirtableRecordIds = new Set();
    const getroToAirtableId = {};
    for (const record of existingAirtableRecords) {
      if (record[JOBS_STRUCTURE.schema.source] === "Getro") {
        existingGetroAirtableRecordIds.add(record.externalId);
        getroToAirtableId[record.externalId] = record.objectID;
      }
    }

    // Create new records for jobs not in airtable
    let newRecordCount = 0;
    getroRecords.forEach(async (record) => {
      try {
        if (/superteam.fun/.test(record["Application Link"])) {
          return;
        }

        if (!existingGetroAirtableRecordIds.has(`${record.externalId}`)) {
          newRecordCount += 1;
          await base(JOBS_STRUCTURE.table).create(record);
          // } else {
          //   const recordId = record.externalId;
          //   const airtableId = getroToAirtableId[recordId];
          //   if (airtableId && recordId) {
          //     await base(JOBS_STRUCTURE.table).update(airtableId, {
          //       [JOBS_STRUCTURE.schema.skill]: record[JOBS_STRUCTURE.schema.skill],
          //     });
          //   }
        }
      } catch (error) {
        await printToSlack(record);
        await printToSlack(error);
        await printToSlack(error.stack);
      }
    });
    print(`Added ${newRecordCount} new getro jobs`);

    // delete duplicate records
    duplicateRecords.forEach(async (record) => {
      try {
        if (record.source === "Getro") {
          await base(JOBS_STRUCTURE.table).update(record.objectID, {
            [JOBS_STRUCTURE.schema.deleted]: "getro-deleted",
          });
        }
      } catch (error) {
        await printToSlack(record);
        await printToSlack(error);
        await printToSlack(error.stack);
      }
    });
    print(`Deduped ${duplicateRecords.length}`);

    // delete records from airtable which aren't present in getro
    const getroRecordIds = new Set(
      getroRecords.map((record) => record.externalId)
    );
    const deletedRecordIds = [...existingGetroAirtableRecordIds].filter(
      (recordId) => !getroRecordIds.has(recordId)
    );
    deletedRecordIds.forEach(async (recordId) => {
      try {
        const airtableId = getroToAirtableId[recordId];
        if (airtableId && recordId) {
          await base(JOBS_STRUCTURE.table).update(airtableId, {
            [JOBS_STRUCTURE.schema.deleted]: "getro-deleted",
          });

          print(`Deleted record ${airtableId} - ${recordId}`);
        } else {
          await printToSlack(`Could not find airtable record for ${recordId}`);
        }
      } catch (error) {
        await printToSlack(recordId);
        await printToSlack(error);
        await printToSlack(error.stack);
      }
    });
    print(`Deleted ${deletedRecordIds.length} getro jobs`);

    return [true, "Success"];
  } catch (error) {
    await printToSlack(error);
    await printToSlack(error.stack);
    return [false, "Error"];
  }
}
