import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT id, DATE(createdAt) as date, positionCount,
   IFNULL(SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(positions, '$[0].aiReason')), 1, 120), 'NULL') as firstAiReason,
   JSON_UNQUOTE(JSON_EXTRACT(positions, '$[0].ticker')) as firstTicker
   FROM portfolioProposalLog ORDER BY createdAt DESC LIMIT 3`
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
