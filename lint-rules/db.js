// Two rules about reaching the database.
//
// shared-db-type: the database type is declared once, as `Db` in app/db, so
// every function that takes a database agrees on what it takes.
//
// module-owned-tables: once a module owns a table, a route asks the module
// and does not import the table (CODING_STANDARDS, "A route does not query
// data a module owns"). Add a table here when a module takes it over.

const MODULE_OF_TABLE = {
  lessonProgress: "lesson-progress",
  videoWatchEvents: "lesson-progress",
  quizAttempts: "quiz-attempts",
  quizAnswers: "quiz-attempts",
};

const sharedDbType = {
  meta: {
    type: "problem",
    messages: {
      shared:
        'Import the database type as `import type { Db } from "~/db"` instead of building it from BetterSQLite3Database.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "drizzle-orm/better-sqlite3") return;
        for (const specifier of node.specifiers) {
          if (specifier.imported?.name === "BetterSQLite3Database") {
            context.report({ node: specifier, messageId: "shared" });
          }
        }
      },
    };
  },
};

const moduleOwnedTables = {
  meta: {
    type: "problem",
    messages: {
      owned:
        "The {{module}} module owns `{{table}}`. Ask ~/modules/{{module}} for it instead of importing the table.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "~/db/schema") return;
        for (const specifier of node.specifiers) {
          const table = specifier.imported?.name;
          const module = table && MODULE_OF_TABLE[table];
          if (module) {
            context.report({
              node: specifier,
              messageId: "owned",
              data: { module, table },
            });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "db" },
  rules: {
    "shared-db-type": sharedDbType,
    "module-owned-tables": moduleOwnedTables,
  },
};
