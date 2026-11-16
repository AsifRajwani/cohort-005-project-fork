// Two rules about reaching the database.
//
// shared-db-type: the database type is declared once, as `Db` in app/db, so
// every function that takes a database agrees on what it takes.
//
// module-owned-tables: once a module owns a table, a route asks the module
// and does not reach the table, by named import, `schema.<table>` or
// `db.query.<table>` (CODING_STANDARDS, "A route does not query
// data a module owns"). Add a table here when a module takes it over.

const MODULE_OF_TABLE = {
  lessonProgress: "lesson-progress",
  videoWatchEvents: "lesson-progress",
  quizAttempts: "quiz-attempts",
  quizAnswers: "quiz-attempts",
};

const isSchema = (source) =>
  source === "~/db/schema" || /(^|\/)db\/schema(\.ts)?$/.test(source);

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
          if (
            specifier.type === "ImportNamespaceSpecifier" ||
            specifier.imported?.name === "BetterSQLite3Database"
          ) {
            context.report({ node: specifier, messageId: "shared" });
          }
        }
      },
      // import("drizzle-orm/better-sqlite3").BetterSQLite3Database<...>
      TSImportType(node) {
        const source = node.source?.value ?? node.argument?.literal?.value;
        if (source === "drizzle-orm/better-sqlite3") {
          context.report({ node, messageId: "shared" });
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
    const report = (node, table) => {
      const module = Object.hasOwn(MODULE_OF_TABLE, table)
        ? MODULE_OF_TABLE[table]
        : undefined;
      if (module) {
        context.report({ node, messageId: "owned", data: { module, table } });
      }
    };
    // Local names of `import * as schema from "~/db/schema"`.
    const namespaces = new Set();
    return {
      ImportDeclaration(node) {
        if (!isSchema(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            namespaces.add(specifier.local.name);
          } else if (specifier.imported) {
            report(specifier, specifier.imported.name);
          }
        }
      },
      // schema.lessonProgress, and db.query.lessonProgress
      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier") return;
        const { object } = node;
        const viaNamespace =
          object.type === "Identifier" && namespaces.has(object.name);
        const viaQuery =
          object.type === "MemberExpression" &&
          !object.computed &&
          object.property.name === "query";
        if (viaNamespace || viaQuery) report(node, node.property.name);
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
