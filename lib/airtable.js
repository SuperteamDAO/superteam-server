import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

import Airtable from "airtable";

Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: process.env.AIRTABLE_API_KEY,
});

const BASE_ID = process.env.AIRTABLE_BASE_ID;

const SPONSORS_STRUCTURE = {
  table: "Sponsors",
  view: "Sponsors Full List",
  schema: {
    foreignKey: "Sponsor (Linked from Sponsors Table)",
    name: "Company Name",
    twitter: "Company Twitter",
    site: "Company URL",
    logo: "Logo",
    industry: "Industry",
    description: "Company Short Bio",
  },
};

const SKILLS_STRUCTURE = {
  table: "Skills",
  view: "Skills",
  defaultSkill: "Other",
  skillForeignKey: "Skills Needed",
  schema: {
    name: "Name",
    parent: "Parent Skill",
  },
};

const WHITELIST_STRUCTURE = {
  table: "Directory Whitelist",
  view: "Whitelist",
  schema: {
    email: "email",
    address: "address",
  },
};

// Structure of the Jobs table
const JOBS_STRUCTURE = {
  table: "Jobs",
  view: "Active Jobs",
  schema: {
    source: "Source",
    externalId: "externalId",
    name: "Opportunity Title",
    description: "Opportunity Description",
    url: "Application Link",
    sponsor: "Sponsor (Linked from Sponsors Table)",
    location: "Location",
    skill: "Skills Needed",
    deleted: "deleted",
    featured: "featured",
    private: "private",
  },
};

// Fetch the airtable data
const TABLES_VIEW_MAP = {
  Jobs: JOBS_STRUCTURE.view,
  Bounties: "Active Bounties",
  Grants: "Active Grants",
};

// Fetch all the sponsors from airtable
async function getSponsorsMap() {
  // Get the base of airtable
  const base = Airtable.base(BASE_ID);

  // Fetch the sponsors and create a map
  const sponsorRecords = await base(SPONSORS_STRUCTURE.table)
    .select({
      view: SPONSORS_STRUCTURE.view,
    })
    .all();

  // generate a sponsors map
  const sponsorsMap = {};
  sponsorRecords.forEach((record) => {
    const fields = record.fields;

    if (Object.keys(fields).length > 0) {
      sponsorsMap[record.id] = {
        ...record.fields,
        recordId: record.id,
      };
    }
  });

  return sponsorsMap;
}

// Fetch the map of skills
async function getSkillsMap() {
  // Get the base of airtable
  const base = Airtable.base(BASE_ID);

  // Fetch the skills and create a map
  const skillRecords = await base(SKILLS_STRUCTURE.table)
    .select({
      view: SKILLS_STRUCTURE.view,
    })
    .all();

  // generate a sponsors map
  const skillsMap = {};
  skillRecords.forEach((record) => {
    const fields = record.fields;

    if (Object.keys(fields).length > 0) {
      skillsMap[record.fields[SKILLS_STRUCTURE.schema.name]] = {
        ...record.fields,
        recordId: record.id,
        parent: record.fields?.[SKILLS_STRUCTURE.schema.parent] ??
          record.fields?.[SKILLS_STRUCTURE.schema.name] ?? [
            SKILLS_STRUCTURE.defaultSkill,
          ],
      };
    }
  });

  return skillsMap;
}

// Get the whitelist of address from airtable
async function getTalentWhiteList() {
  // Get the base of airtable
  const base = Airtable.base(BASE_ID);

  // Fetch all whitelist records
  const records = await base(WHITELIST_STRUCTURE.table)
    .select({
      view: WHITELIST_STRUCTURE.view,
    })
    .all();

  // generate a set of whitelisted addresses
  const whitelist = new Set();
  records.forEach((record) => {
    const fields = record.fields;

    if (Object.keys(fields).length > 0) {
      whitelist.add(record.fields[WHITELIST_STRUCTURE.schema.address]);
    }
  });

  return whitelist;
}

// Fetch all the airtable data for Jobs, Grants, Bounties
async function getAirtableRecords() {
  const uniqueRecords = new Set();
  const duplicateRecords = [];
  const base = Airtable.base(BASE_ID);

  // We need the sponsorMap to expand the details of the sponsor
  // airtable gives a sponsorId and not the details
  const sponsorsMap = await getSponsorsMap();
  const skills = await getSkillsMap();
  const skillsMap = {};
  for (const value of Object.values(skills)) {
    skillsMap[value.recordId] = value;
  }

  // Parse the columnStructure to extract records
  const results = [];
  for (let [table, view] of Object.entries(TABLES_VIEW_MAP)) {
    const records = await base(table).select({ view }).all();

    records.forEach(async (record) => {
      const fields = record.fields;

      if (Object.keys(fields).length > 0) {
        const sponsorId =
          fields?.[SPONSORS_STRUCTURE.schema.foreignKey]?.[0] || null;
        const privateListing = fields?.[JOBS_STRUCTURE.schema.private] || false;
        let featured = fields?.[JOBS_STRUCTURE.schema.featured] || false;
        let sponsorName = "";
        let sponsorUrl = "";
        let sponsorIndustry = "";
        let sponsorBio = "";
        let sponsorSite = "";
        let sponsorTwitter = "";
        if (sponsorId) {
          sponsorName =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.name] ?? "";
          sponsorUrl =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.logo]?.[0]
              ?.url ?? "";
          sponsorIndustry =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.industry]?.[0] ??
            "";
          sponsorBio =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.description] ??
            "";
          sponsorTwitter =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.twitter] ??
            "https://twitter.com/superteamdao";
          sponsorSite =
            sponsorsMap[sponsorId]?.[SPONSORS_STRUCTURE.schema.site] ??
            "https://earn.superteam.fun";
        }

        // We want to mark all Solana Foundation opportunities as featured
        featured = sponsorName === "Solana Foundation" || featured;

        const data = {
          objectID: record.id,
          ...fields,
          sponsorName,
          sponsorUrl,
          sponsorIndustry,
          sponsorBio,
          sponsorTwitter,
          sponsorSite,
          skills: fields?.[SKILLS_STRUCTURE.skillForeignKey]?.flatMap(
            (skill) => skillsMap[skill].parent
          ),
          type: table,
          category: table,
          featured,
          private: privateListing,
        };

        // Only jobs have a getro externalId, while Bounties and Grants don't
        if (table !== "Jobs" || !uniqueRecords.has(data.externalId)) {
          results.push(data);
        }

        if (uniqueRecords.has(data.externalId) && table === "Jobs") {
          duplicateRecords.push(data);
        }

        uniqueRecords.add(data.externalId);
      }
    });
  }

  return [results, duplicateRecords];
}

export {
  Airtable,
  BASE_ID,
  SKILLS_STRUCTURE,
  SPONSORS_STRUCTURE,
  JOBS_STRUCTURE,
  getSkillsMap,
  getSponsorsMap,
  getAirtableRecords,
  getTalentWhiteList,
};
