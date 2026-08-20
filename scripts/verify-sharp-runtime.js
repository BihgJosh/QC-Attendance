const sharp = require("sharp");

async function verify() {
  const result = await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#00000000" },
  }).webp().toBuffer();

  if (!result.length) throw new Error("Sharp produced an empty image.");
  console.log(`Sharp runtime verified (${sharp.versions.vips}).`);
}

verify().catch((error) => {
  console.error("Sharp runtime verification failed.", error);
  process.exitCode = 1;
});
