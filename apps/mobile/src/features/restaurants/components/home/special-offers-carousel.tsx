import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

type SpecialOffer = {
  id: string;
  title: string;
  tag: string;
  tagBg: string;
  imageUrl: string;
} & (
  | {
      type: 'promo';
      promoCode: string;
    }
  | {
      type: 'feature';
      code: string;
    }
);

const SPECIAL_OFFERS: SpecialOffer[] = [
  {
    id: '1',
    type: 'promo',
    title: '50% Off First Order',
    promoCode: 'TASTY50',
    tag: 'Limited Time',
    tagBg: 'bg-primary',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDwlt7N_i3aWRp2VHbLgQmZ6k6gj96k-SslATcMloH8nym9v2Yix9HPc6kpFLatV7Li6BYTIFlz379nAENGr5h_ft3GEd5uPMNjkhjk0K0ZSrcaq-n5d9Ywt_0pbaeu72cLYCJOLoCaAi-OeGD4-6mfpcrt5AFTOm6iQSaX-gYFy-mzS1fCZMFNQXX4IxTYejhgv5Sds8DcCvua6PlcKoO_Jc8b6iiHogp9s-tIewrSensPEdNrOic8AhpvXiwHgIrgMXjOjqO6sL-z',
  },
  {
    id: '2',
    type: 'feature',
    title: 'Top Rated Bowls',
    code: 'Healthy & Delicious',
    tag: 'Trending',
    tagBg: 'bg-secondary',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDPE2kvoWKkyBMIdyp4KqLer9OI7B_ZZa1GlQjw8e_8jGaRxZLiSi2IYdtJdkg3mjshv8V0VzXqOrTPow-FLGxnUDfWTlOKpBFle-9Q5CKJyYdn4AJ4XWIUN5cHItF59-Fj3V2lsr4oKaQ2sU7u0rAMXaejNmqNL-2G-kuQN0mce1J6gpyJFPfQVOtXhy1VC0odLDXzuO-hAhVlCA3cHRhR0oU91RNM_5UQO4vfU1z235ZekNO0MsTIEkh27oKYECOS8SLM7sMtdEJC',
  },
];

interface SpecialOffersCarouselProps {
  onOfferPress: (offerTitle: string) => void;
}

export function SpecialOffersCarousel({
  onOfferPress,
}: SpecialOffersCarouselProps) {
  return (
    <View className="mb-10">
      <ScrollView
        horizontal
        snapToInterval={320}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ gap: 16, paddingRight: 32 }}
      >
        {SPECIAL_OFFERS.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            onPress={() => onOfferPress(offer.title)}
            className="w-80 h-48 rounded-3xl overflow-hidden shadow-lg relative active:scale-[0.98]"
          >
            <Image
              source={{ uri: offer.imageUrl }}
              className="w-full h-full"
              contentFit="cover"
            />
            <View className="absolute inset-0 bg-black/40 p-5 justify-end">
              <View
                className={`${offer.tagBg} px-2.5 py-1 rounded-md self-start mb-2`}
              >
                <Text className="text-on-primary text-[10px] font-bold uppercase tracking-wide">
                  {offer.tag}
                </Text>
              </View>
              <Text className="text-white font-jakarta-sans font-bold text-2xl leading-tight">
                {offer.title}
              </Text>
              <Text className="text-white/90 font-inter text-sm mt-1">
                {offer.type === 'promo'
                  ? `Code: ${offer.promoCode}`
                  : offer.code}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
