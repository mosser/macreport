/** Breakfast, lunch or dinner, the three meals of a per diem. */
export class Meal {
  static readonly breakfast = new Meal('breakfast', 'Breakfast')
  static readonly lunch = new Meal('lunch', 'Lunch')
  static readonly dinner = new Meal('dinner', 'Dinner')

  /** Every meal, in the order of a day: breakfast, lunch, dinner. */
  static readonly all: readonly Meal[] = [Meal.breakfast, Meal.lunch, Meal.dinner]

  /** The meal as a sentence names it: breakfast. */
  readonly name: string
  /** The meal as a heading names it: Breakfast. */
  readonly title: string

  private constructor(name: string, title: string) {
    this.name = name
    this.title = title
  }

  /** The meal of a name, as a sentence names it, or absent when the name is not one. */
  static named(name: string): Meal | undefined {
    return Meal.all.find((meal) => meal.name === name)
  }
}
