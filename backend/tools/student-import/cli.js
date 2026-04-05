const { buildImportPlan, importStudentAccounts } = require("./index.js");

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node backend/tools/student-import/cli.js --file <students.xlsx> [options]",
      "",
      "Options:",
      "  --file, -f              Duong dan toi file .xlsx hoac .csv",
      "  --sheet, -s             Ten worksheet can doc",
      "  --dry-run               Chi parse/validate, khong ghi vao Supabase",
      "  --limit                 Gioi han so dong import",
      "  --email-domain          Ghi de default email domain",
      "  --default-password      Ghi de default password",
      "  --keep-password         Khong reset password neu account da ton tai",
      "  --delay-ms              Delay giua moi account, mac dinh 200ms",
      "  --help, -h              Hien huong dan",
      "",
      "Cot de xuat trong Excel:",
      "  mssv | name | gender | course | email | password | login_id | role",
      "",
      "Vi du:",
      "  npm run import:students -- --file ..\\data\\students.xlsx --sheet Sheet1",
      "  npm run import:students -- --file backend\\tools\\student-import\\template.xlsx --dry-run",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    delayMs: 200,
    dryRun: false,
    filePath: "",
    keepPassword: false,
    sheetName: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--keep-password") {
      options.keepPassword = true;
      continue;
    }

    if (arg === "--file" || arg === "-f") {
      options.filePath = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--sheet" || arg === "-s") {
      options.sheetName = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      options.limit = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--email-domain") {
      options.defaultEmailDomain = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--default-password") {
      options.defaultPassword = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--delay-ms") {
      options.delayMs = argv[index + 1] || "200";
      index += 1;
      continue;
    }

    throw new Error(`Khong nhan dien duoc tham so: ${arg}`);
  }

  return options;
}

function printPlan(plan) {
  console.log("");
  console.log(`File: ${plan.filePath}`);
  console.log(`Worksheet: ${plan.sheetName}`);
  console.log(`Dong du lieu: ${plan.rawRowCount}`);
  console.log(`Ban ghi se xu ly: ${plan.records.length}`);
  console.log(
    `Default email domain: ${plan.defaults.defaultEmailDomain || "(khong co)"}`,
  );
  console.log(
    `Default password: ${plan.defaults.keepPassword ? "(giu nguyen password cu neu da co)" : plan.defaults.defaultPassword ? "(da cau hinh)" : "(khong co)"}`,
  );

  if (plan.records.length > 0) {
    console.log("");
    console.log("Preview 5 dong dau:");
    plan.records.slice(0, 5).forEach((record) => {
      console.log(
        `- Dong ${record.rowNumber}: ${record.loginId} | ${record.studentName} | ${record.email} | ${record.role}`,
      );
    });
  }
}

async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help || !options.filePath) {
    printUsage();
    return options.filePath ? 0 : 1;
  }

  const plan = await buildImportPlan(options);
  printPlan(plan);

  if (plan.issues.length > 0) {
    console.log("");
    console.log("File import dang co loi:");
    plan.issues.forEach((issue) => {
      console.log(`- ${issue}`);
    });
    return 1;
  }

  if (options.dryRun) {
    console.log("");
    console.log("Dry-run thanh cong. Khong co thay doi nao duoc ghi vao Supabase.");
    return 0;
  }

  console.log("");
  console.log(`Bat dau import ${plan.records.length} tai khoan...`);
  console.log("");

  const result = await importStudentAccounts({
    ...options,
    plan,
    onError({ error, record }) {
      console.error(
        `✖ Dong ${record.rowNumber} | ${record.loginId || record.email}: ${error.message}`,
      );
    },
    onProgress({ authAction, index, record, total }) {
      const label = authAction === "created" ? "Tao moi" : "Cap nhat";
      console.log(
        `✔ [${index}/${total}] ${label}: ${record.loginId} (${record.email})`,
      );
    },
  });

  console.log("");
  console.log("Tong ket:");
  console.log(`- So ban ghi: ${result.summary.total}`);
  console.log(`- Thanh cong: ${result.summary.processed}`);
  console.log(`- Auth tao moi: ${result.summary.authCreated}`);
  console.log(`- Auth cap nhat: ${result.summary.authUpdated}`);
  console.log(`- Profile upsert: ${result.summary.profilesUpserted}`);
  console.log(`- That bai: ${result.summary.failed}`);

  if (result.failures.length > 0) {
    console.log("");
    console.log("Danh sach loi:");
    result.failures.forEach((failure) => {
      console.log(
        `- Dong ${failure.rowNumber} | ${failure.email}: ${failure.error}`,
      );
    });
    return 1;
  }

  return 0;
}

if (require.main === module) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    });
}

module.exports = {
  runCli,
};
