/** Function pages for search. Each maps to an existing lesson that gets embedded as a live exercise. */
export const FUNCTION_PAGES: { slug: string; name: string; lessonId: string; what: string; syntax: string; example: string }[] = [
  { slug: "sum", name: "SUM", lessonId: "sum-basic-01", what: "adds the numbers in a range of cells.", syntax: "=SUM(B2:B5)", example: "Total of four monthly sales in one cell." },
  { slug: "average", name: "AVERAGE", lessonId: "avg-01", what: "finds the mean of the numbers in a range.", syntax: "=AVERAGE(B2:B5)", example: "Average marks of a class." },
  { slug: "if", name: "IF", lessonId: "if-basic-01", what: "returns one result when a test is true and another when it is false.", syntax: '=IF(B2>=50,"Pass","Fail")', example: "Mark each student Pass or Fail." },
  { slug: "vlookup", name: "VLOOKUP", lessonId: "vlookup-basic-01", what: "looks up a value in the first column of a table and returns a value from another column in the same row.", syntax: "=VLOOKUP(A2,$E$2:$F$10,2,FALSE)", example: "Find a product price from its code." },
  { slug: "count", name: "COUNT", lessonId: "count-01", what: "counts how many cells in a range contain numbers.", syntax: "=COUNT(B2:B20)", example: "How many invoices have an amount entered." },
  { slug: "absolute-reference", name: "Absolute reference ($)", lessonId: "refs-absolute-01", what: "locks a cell reference so it does not move when you copy the formula.", syntax: "=B2*$E$1", example: "Apply one tax rate to every row." },
];
