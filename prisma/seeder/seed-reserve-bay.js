import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

function getRandomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

// Sample data for business types
const businessTypes = [
  "Klinik Swasta",
  "Agensi Kerajaan",
  "Bank / Institusi Kewangan",
  "Kilang",
  "Kedai Membaiki Kenderaan / Motorsikal",
  "Industri Kecil / Sederhana",
  "Hotel Bajet",
  "Lain - Lain",
];

// Total lots as strings
const totalLots = ["3 Bulan: RM 300", "6 Bulan: RM 600", "12 Bulan: RM 1,200"];

// Mapping of total lots to integers
const totalLotsMapping = {
  "3 Bulan: RM 300": 300, // Store the number of lots as integers
  "6 Bulan: RM 600": 600,
  "12 Bulan: RM 1,200": 1200,
};

async function main() {
  // Fetch existing users from the database
  const users = await prisma.user.findMany({
    take: 5, // Adjust the number of users to take as needed
  });

  if (users.length === 0) {
    console.error("No users found in the database.");
    return;
  }

  // Create sample ReserveBay entries using existing user IDs
  for (let i = 0; i < 100; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)]; // Randomly select a user

    const totalLotRequiredKey =
      totalLots[Math.floor(Math.random() * totalLots.length)];
    const totalLotRequiredValue = totalLotsMapping[totalLotRequiredKey];

    // Generate a random createdAt date between 2022 and 2024
    const createdAt = getRandomDate(
      new Date(2022, 0, 1),
      new Date(2024, 11, 31),
    );

    const reserveBay = await prisma.reserveBay.create({
      data: {
        id: uuidv4(),
        userId: randomUser.id,
        companyName: `Company ${i + 1}`,
        companyRegistration: `CR-${i + 1}`,
        businessType:
          businessTypes[Math.floor(Math.random() * businessTypes.length)],
        address1: `Address ${i + 1}`,
        address2: `Address 2-${i + 1}`,
        postcode: "12345",
        city: `City-${i + 1}`,
        state: `State-${i + 1}`,
        picFirstName: `FirstName-${i + 1}`,
        picSecondName: `SecondName-${i + 1}`,
        phoneNumber: `555-555-55${i}`,
        email: `company${i + 1}@example.com`,
        idNumber: `ID-${i + 1}`,
        totalLotRequired: totalLotRequiredValue, // Use the integer value here
        reason: "For business parking needs",
        lotNumber: `Lot-${i + 1}`,
        location: `Location-${i + 1}`,
        designatedBayPicture:
          "https://letsenhance.io/static/8f5e523ee6b2479e26ecc91b9c25261e/1015f/MainAfter.jpg",
        registerNumberPicture:
          "https://letsenhance.io/static/8f5e523ee6b2479e26ecc91b9c25261e/1015f/MainAfter.jpg",
        idCardPicture: "https://pdfobject.com/pdf/sample.pdf",
        createdAt: createdAt, // Use the random createdAt date
      },
    });

    console.log("Reserve Bay created:", reserveBay);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
