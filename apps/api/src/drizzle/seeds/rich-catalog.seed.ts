import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rich Catalog Seed Script
 *
 * This script adds realistic, high-quality restaurant and menu data.
 * It uses descriptive text to simulate a real-world production environment.
 */

async function main() {
  console.log('🌱 Starting rich catalog seeding...');

  // 1. Get an owner user (reusing Owner 1 from existing seed if possible, or finding one)
  const ownerId = '11111111-1111-4111-8111-111111111111'; // Fixed ID from Master Seed

  // 2. Define Restaurants
  const restaurantsData = [
    {
      id: uuidv4(),
      ownerId,
      name: "Pizza 4P's",
      description:
        'Nhà hàng Pizza thủ công với triết lý "Từ trang trại đến bàn ăn", nổi tiếng với phô mai tự làm và pizza nướng củi.',
      address: '8/15 Lê Thánh Tôn, Quận 1, TP.HCM',
      phone: '1900 6043',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Italian',
      latitude: 10.778,
      longitude: 106.703,
    },
    {
      id: uuidv4(),
      ownerId,
      name: 'The Coffee House',
      description:
        'Không gian cà phê hiện đại, nơi kết nối mọi người qua những tách cà phê đậm đà và trà trái cây thanh mát.',
      address: '183 Hoa Hồng, Phú Nhuận, TP.HCM',
      phone: '1800 6936',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Cafe',
      latitude: 10.796,
      longitude: 106.685,
    },
    {
      id: uuidv4(),
      ownerId,
      name: 'Món Huế',
      description:
        'Tinh hoa ẩm thực cố đô với những món ăn đậm đà, tinh tế và mang đậm nét văn hóa Huế.',
      address: '92 Nam Kỳ Khởi Nghĩa, Quận 1, TP.HCM',
      phone: '028 3827 0101',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Vietnamese',
      latitude: 10.774,
      longitude: 106.701,
    },
    {
      id: uuidv4(),
      ownerId,
      name: 'Haidilao Hotpot',
      description:
        'Trải nghiệm lẩu Trung Hoa đẳng cấp với dịch vụ tận tâm và nước lẩu đa dạng, đậm đà.',
      address: 'Tòa nhà Bitexco, Quận 1, TP.HCM',
      phone: '028 6273 1000',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Chinese',
      latitude: 10.771,
      longitude: 106.704,
    },
  ];

  for (const r of restaurantsData) {
    await db.insert(schema.restaurants).values(r).onConflictDoNothing();
    console.log(`✅ Seeded restaurant: ${r.name}`);

    // Create a default delivery zone for each
    const zoneId = uuidv4();
    await db
      .insert(schema.deliveryZones)
      .values({
        id: zoneId,
        restaurantId: r.id,
        name: 'Khu vực trung tâm (5km)',
        radiusKm: 5,
        baseFee: 15000,
        perKmRate: 5000,
        avgSpeedKmh: 30,
        prepTimeMinutes: 20,
        bufferMinutes: 5,
        isActive: true,
      })
      .onConflictDoNothing();

    // Create Menu Categories and Items
    if (r.name === "Pizza 4P's") {
      const catId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catId,
        restaurantId: r.id,
        name: 'Signature Pizza',
        displayOrder: 1,
      });

      const items = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Pizza 4 Phô Mai',
          description:
            'Sự kết hợp hoàn hảo của 4 loại phô mai tự làm (Mozzarella, Camembert, Gorgonzola, Parmesan), ăn kèm với mật ong rừng nguyên chất.',
          price: 250000,
          tags: ['pizza', 'cheese', 'honey'],
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Pizza Cá Hồi Xông Khói',
          description:
            'Cá hồi xông khói tươi ngon kết hợp cùng phô mai cream cheese béo ngậy, hành tây và thì là trên nền đế bánh giòn rụm.',
          price: 290000,
          tags: ['pizza', 'seafood', 'salmon'],
          status: 'available' as const,
        },
      ];
      await db.insert(schema.menuItems).values(items);

      const catPastaId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catPastaId,
        restaurantId: r.id,
        name: 'Pasta',
        displayOrder: 2,
      });
      await db.insert(schema.menuItems).values({
        id: uuidv4(),
        restaurantId: r.id,
        categoryId: catPastaId,
        name: 'Mỳ Ý Cua Sốt Cà Chua',
        description:
          'Thịt cua tươi xào cùng sốt cà chua đậm đà, tỏi, ớt cay nhẹ và dầu ô liu nguyên chất.',
        price: 220000,
        tags: ['pasta', 'seafood', 'crab'],
        status: 'available' as const,
      });
    }

    if (r.name === 'The Coffee House') {
      const catDrinksId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catDrinksId,
        restaurantId: r.id,
        name: 'Đồ uống đặc trưng',
        displayOrder: 1,
      });

      const drinks = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catDrinksId,
          name: 'Trà Đào Cam Sả',
          description:
            'Thức uống trứ danh với vị trà thanh khiết, những miếng đào giòn tan, cam tươi mọng nước và hương sả nồng nàn.',
          price: 55000,
          tags: ['drink', 'tea', 'fruit'],
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catDrinksId,
          name: 'Cà Phê Sữa Đá',
          description:
            'Hương vị cà phê Việt Nam truyền thống, pha phin đậm đà từ hạt cà phê Robusta và sữa đặc béo ngậy.',
          price: 35000,
          tags: ['drink', 'coffee'],
          status: 'available' as const,
        },
      ];
      await db.insert(schema.menuItems).values(drinks);

      const catFoodId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catFoodId,
        restaurantId: r.id,
        name: 'Thức ăn kèm',
        displayOrder: 2,
      });
      await db.insert(schema.menuItems).values({
        id: uuidv4(),
        restaurantId: r.id,
        categoryId: catFoodId,
        name: 'Bánh Mì Que',
        description:
          'Bánh mì nhỏ giòn rụm với nhân pate gan béo bùi đặc trưng và tương ớt cay nồng.',
        price: 15000,
        tags: ['food', 'bread', 'pate'],
        status: 'available' as const,
      });
    }

    if (r.name === 'Món Huế') {
      const catHueId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catHueId,
        restaurantId: r.id,
        name: 'Đặc sản Huế',
        displayOrder: 1,
      });

      const dishes = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catHueId,
          name: 'Bún Bò Huế Đặc Biệt',
          description:
            'Nước dùng đậm đà hương mắm ruốc cố đô, ăn kèm bắp bò mềm, giò heo béo ngậy, chả cua và tiết luộc.',
          price: 95000,
          tags: ['noodle', 'beef', 'hue'],
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catHueId,
          name: 'Bánh Bèo Chén (6 chén)',
          description:
            'Những chiếc bánh bèo nhỏ xinh trong chén sứ, phủ lên trên là tôm chấy, mỡ hành thơm phức và da heo chiên giòn.',
          price: 45000,
          tags: ['hue', 'steamed'],
          status: 'available' as const,
        },
      ];
      await db.insert(schema.menuItems).values(dishes);
    }

    if (r.name === 'Haidilao Hotpot') {
      const catSoupId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catSoupId,
        restaurantId: r.id,
        name: 'Nước lẩu',
        displayOrder: 1,
      });
      await db.insert(schema.menuItems).values({
        id: uuidv4(),
        restaurantId: r.id,
        categoryId: catSoupId,
        name: 'Nước Lẩu Cà Chua',
        description:
          'Vị chua ngọt tự nhiên từ cà chua tươi chọn lọc, giàu vitamin và phù hợp cho mọi lứa tuổi.',
        price: 120000,
        tags: ['hotpot', 'soup', 'tomato'],
        status: 'available' as const,
      });

      const catMeatId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catMeatId,
        restaurantId: r.id,
        name: 'Thịt nhúng lẩu',
        displayOrder: 2,
      });
      await db.insert(schema.menuItems).values({
        id: uuidv4(),
        restaurantId: r.id,
        categoryId: catMeatId,
        name: 'Thịt Bò Haidilao',
        description:
          'Thịt bò thượng hạng thái lát mỏng, có độ vân mỡ hoàn hảo, mềm tan trong miệng khi nhúng lẩu.',
        price: 250000,
        tags: ['meat', 'beef', 'hotpot'],
        status: 'available' as const,
      });
    }
  }

  console.log('🌱 Rich catalog seeding completed!');
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
