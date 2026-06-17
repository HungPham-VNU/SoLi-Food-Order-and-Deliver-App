import { Injectable } from '@nestjs/common';
import {
  type NutritionUnit,
  SUPPORTED_CONVERSION_UNITS,
} from '../types/nutrition.types';

export interface UnitConversionInput {
  ingredientName: string;
  quantity: number | null;
  unit: NutritionUnit;
}

export interface UnitConversionResult {
  quantityGram: number | null;
  requiresConfirmation: boolean;
  notes: string[];
}

@Injectable()
export class UnitConversionService {
  isSupported(unit: NutritionUnit): boolean {
    return (SUPPORTED_CONVERSION_UNITS as readonly string[]).includes(unit);
  }

  convertToGrams(input: UnitConversionInput): UnitConversionResult {
    if (input.quantity === null) {
      return {
        quantityGram: null,
        requiresConfirmation: true,
        notes: [`Quantity is missing for ${input.ingredientName}.`],
      };
    }

    const name = this.normalize(input.ingredientName);
    const quantity = input.quantity;

    switch (input.unit) {
      case 'g':
        return {
          quantityGram: quantity,
          requiresConfirmation: false,
          notes: [],
        };
      case 'kg':
        return {
          quantityGram: quantity * 1000,
          requiresConfirmation: false,
          notes: [],
        };
      case 'ml':
        return this.estimated(
          quantity,
          '1 ml is estimated as 1 g for water-like ingredients.',
        );
      case 'l':
        return this.estimated(
          quantity * 1000,
          '1 l is estimated as 1000 g for water-like ingredients.',
        );
      case 'tbsp':
        return this.convertSpoon(name, quantity, 'tbsp');
      case 'tsp':
        return this.convertSpoon(name, quantity, 'tsp');
      case 'piece':
        if (this.isEgg(name)) {
          return {
            quantityGram: quantity * 50,
            requiresConfirmation: false,
            notes: [],
          };
        }

        return {
          quantityGram: null,
          requiresConfirmation: true,
          notes: [
            `Piece-based quantity for ${input.ingredientName} requires restaurant confirmation.`,
          ],
        };
      case 'cup':
      case 'bowl':
        return {
          quantityGram: null,
          requiresConfirmation: true,
          notes: [
            `${this.formatUnit(input.unit)} quantity for ${input.ingredientName} requires restaurant confirmation or conversion to g/ml.`,
          ],
        };
      case 'bunch':
      case 'pinch':
        return {
          quantityGram: null,
          requiresConfirmation: true,
          notes: [
            `${this.formatUnit(input.unit)} quantity for ${input.ingredientName} is too variable for automatic conversion.`,
          ],
        };
      case 'unknown':
      default:
        return {
          quantityGram: null,
          requiresConfirmation: true,
          notes: [
            `Unit ${input.unit} is not supported for automatic conversion.`,
          ],
        };
    }
  }

  private convertSpoon(
    normalizedName: string,
    quantity: number,
    unit: 'tbsp' | 'tsp',
  ): UnitConversionResult {
    if (this.isOil(normalizedName)) {
      const grams = unit === 'tbsp' ? 13.5 : 4.5;
      return this.estimated(
        quantity * grams,
        `1 ${unit} of oil is estimated as ${grams} g.`,
      );
    }

    if (this.isSugar(normalizedName)) {
      const grams = unit === 'tbsp' ? 12.5 : 4;
      return this.estimated(
        quantity * grams,
        `1 ${unit} of sugar is estimated as ${grams} g.`,
      );
    }

    const grams = unit === 'tbsp' ? 15 : 5;
    return this.estimated(
      quantity * grams,
      `1 ${unit} is estimated as ${grams} g for water-like ingredients.`,
    );
  }

  private estimated(quantityGram: number, note: string): UnitConversionResult {
    return {
      quantityGram,
      requiresConfirmation: true,
      notes: [note],
    };
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private isOil(normalizedName: string): boolean {
    return normalizedName.includes('dau') || normalizedName.includes('oil');
  }

  private isSugar(normalizedName: string): boolean {
    return normalizedName.includes('duong') || normalizedName.includes('sugar');
  }

  private isEgg(normalizedName: string): boolean {
    return normalizedName.includes('trung') || normalizedName.includes('egg');
  }

  private formatUnit(unit: NutritionUnit): string {
    return unit.charAt(0).toUpperCase() + unit.slice(1);
  }
}
