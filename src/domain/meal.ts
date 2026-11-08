import { Amount } from './amount.ts'

/**
 * Breakfast, lunch or dinner, the three meals of a per diem, each with its rate: what it is worth
 * claimed, in Canadian dollars for a domestic per diem, in US dollars for an international one.
 */
export class Meal {
  /** Breakfast, at 28.40. */
  static readonly breakfast = new Meal('breakfast', 'Breakfast', new Amount(2840))
  /** Lunch, at 27.40. */
  static readonly lunch = new Meal('lunch', 'Lunch', new Amount(2740))
  /** Dinner, at 57.70. */
  static readonly dinner = new Meal('dinner', 'Dinner', new Amount(5770))

  /** Every meal, in the order of a day: breakfast, lunch, dinner. */
  static readonly all: readonly Meal[] = [Meal.breakfast, Meal.lunch, Meal.dinner]

  /** The meal as a sentence names it: breakfast. */
  readonly name: string
  /** The meal as a heading names it: Breakfast. */
  readonly title: string
  /** What the meal claimed is worth, in the currency of its per diem. */
  readonly rate: Amount

  private constructor(name: string, title: string, rate: Amount) {
    this.name = name
    this.title = title
    this.rate = rate
  }

  /** The meal of a name, as a sentence names it, or absent when the name is not one. */
  static named(name: string): Meal | undefined {
    return Meal.all.find((meal) => meal.name === name)
  }
}
