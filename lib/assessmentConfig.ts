export type RoleId =
  | "ai_ml"
  | "product_manager"
  | "financial_analyst"
  | "business_analyst"
  | "java_full_stack"
  | "python_full_stack";

export type DemandLevel = "Low" | "Medium" | "High";

export type RoleMarketInfo = {
  roleId: RoleId;
  label: string;
  demand: DemandLevel;
  supply: DemandLevel;
  averageCompanyUsd: string;
  topTierUsd: string;
  codingLanguage?: "python" | "java";
};

export type DomainQuestion = {
  id: string;
  kind: "mcq" | "text";
  prompt: string;
  options?: string[];
  correctAnswer?: string; // For MCQ questions - the correct option
};

export type CodingProblem = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  title: string;
  prompt: string;
  hint: string;
  starterCode: { python?: string; java?: string };
};

export const ROLE_MARKET: RoleMarketInfo[] = [
  {
    roleId: "ai_ml",
    label: "AI / ML Engineer",
    demand: "High",
    supply: "Medium",
    averageCompanyUsd: "$160k–$260k (total)",
    topTierUsd: "$300k–$550k+ (total)",
    codingLanguage: "python",
  },
  {
    roleId: "product_manager",
    label: "Product Manager",
    demand: "High",
    supply: "High",
    averageCompanyUsd: "$180k–$280k (total)",
    topTierUsd: "$300k–$550k+ (total)",
  },
  {
    roleId: "financial_analyst",
    label: "Financial Analyst",
    demand: "Medium",
    supply: "High",
    averageCompanyUsd: "$90k–$140k (base)",
    topTierUsd: "$160k–$300k+ (total)",
  },
  {
    roleId: "business_analyst",
    label: "Business Analyst",
    demand: "High",
    supply: "High",
    averageCompanyUsd: "$95k–$150k (total)",
    topTierUsd: "$170k–$260k+ (total)",
  },
  {
    roleId: "java_full_stack",
    label: "Java Full Stack Developer",
    demand: "High",
    supply: "High",
    averageCompanyUsd: "$110k–$170k (total)",
    topTierUsd: "$180k–$320k+ (total)",
    codingLanguage: "java",
  },
  {
    roleId: "python_full_stack",
    label: "Python Full Stack Developer",
    demand: "High",
    supply: "High",
    averageCompanyUsd: "$115k–$175k (total)",
    topTierUsd: "$180k–$320k+ (total)",
    codingLanguage: "python",
  },
];

export const DOMAIN_QUESTIONS: Record<RoleId, DomainQuestion[]> = {
  ai_ml: [
    { id: "ml_1", kind: "mcq", prompt: "What is overfitting?", options: ["Model performs well on new data", "Model performs well on training but poorly on new data", "Training is too slow", "Dataset is too small"], correctAnswer: "Model performs well on training but poorly on new data" },
    { id: "ml_2", kind: "mcq", prompt: "Train / Validation / Test split is mainly used to…", options: ["Increase dataset size", "Measure generalization and avoid leakage", "Make training faster", "Remove noise automatically"], correctAnswer: "Measure generalization and avoid leakage" },
    { id: "ml_3", kind: "mcq", prompt: "Which is a classification metric?", options: ["RMSE", "Accuracy", "MAE", "R²"], correctAnswer: "Accuracy" },
    { id: "ml_4", kind: "mcq", prompt: "Which step usually comes first?", options: ["Model deployment", "Data understanding & cleaning", "A/B testing", "Hyperparameter tuning"], correctAnswer: "Data understanding & cleaning" },
    { id: "ml_5", kind: "text", prompt: "In one line: what does gradient descent do?" },
    { id: "ml_6", kind: "mcq", prompt: "RAG stands for…", options: ["Retrieval-Augmented Generation", "Randomized AI Gradient", "Recurrent Attention Graph", "Rapid Agent Generation"], correctAnswer: "Retrieval-Augmented Generation" },
    { id: "ml_7", kind: "text", prompt: "Name 2 common causes of data leakage." },
    { id: "ml_8", kind: "mcq", prompt: "For imbalanced classes, which is often more informative than accuracy?", options: ["Precision/Recall", "MSE", "R²", "Silhouette score"], correctAnswer: "Precision/Recall" },
    { id: "ml_9", kind: "text", prompt: "What is a feature? (short)" },
    { id: "ml_10", kind: "text", prompt: "What does a confusion matrix show? (short)" },
    { id: "ml_11", kind: "mcq", prompt: "What does regularization mainly help with?", options: ["Overfitting", "Underfitting", "Data collection", "Labeling speed"], correctAnswer: "Overfitting" },
    { id: "ml_12", kind: "text", prompt: "Explain bias vs variance in 2 short lines." },
  ],
  product_manager: [
    { id: "pm_1", kind: "text", prompt: "Define product-market fit in one line." },
    { id: "pm_2", kind: "mcq", prompt: "A good PRD should primarily…", options: ["List UI colors", "Describe the problem, users, and success metrics", "Avoid measurable goals", "Only contain engineering tasks"] },
    { id: "pm_3", kind: "text", prompt: "Name 2 north-star metrics you have used (or would use)." },
    { id: "pm_4", kind: "mcq", prompt: "What is an MVP?", options: ["Most Valuable Product", "Minimum Viable Product", "Maximum Verified Plan", "Market Validation Package"] },
    { id: "pm_5", kind: "text", prompt: "How do you decide what to build next? (short)" },
    { id: "pm_6", kind: "mcq", prompt: "Which is a prioritization framework?", options: ["RICE", "RGB", "HTTP", "CRUD"] },
    { id: "pm_7", kind: "text", prompt: "How do you handle stakeholder conflict? (short)" },
    { id: "pm_8", kind: "text", prompt: "What is a user persona? (short)" },
    { id: "pm_9", kind: "mcq", prompt: "A/B testing helps with…", options: ["Replacing QA", "Comparing impact of two variants", "Writing specs", "Reducing server cost"] },
    { id: "pm_10", kind: "text", prompt: "Give one example of a trade-off you made in a product decision." },
    { id: "pm_11", kind: "text", prompt: "What is churn? (short)" },
    { id: "pm_12", kind: "text", prompt: "What is a roadmap? (short)" },
  ],
  financial_analyst: [
    { id: "fa_1", kind: "mcq", prompt: "A balance sheet equation is…", options: ["Revenue - Expenses = Profit", "Assets = Liabilities + Equity", "Cash + Debt = EBITDA", "Assets - Equity = Revenue"] },
    { id: "fa_2", kind: "text", prompt: "Define EBITDA in one line." },
    { id: "fa_3", kind: "mcq", prompt: "Which is a liquidity ratio?", options: ["Current ratio", "Gross margin", "ROE", "EV/EBITDA"] },
    { id: "fa_4", kind: "text", prompt: "What is working capital? (short)" },
    { id: "fa_5", kind: "mcq", prompt: "DCF stands for…", options: ["Discounted Cash Flow", "Direct Cost Forecast", "Debt Coverage Factor", "Daily Cash Frequency"] },
    { id: "fa_6", kind: "text", prompt: "What is the purpose of sensitivity analysis? (short)" },
    { id: "fa_7", kind: "mcq", prompt: "If interest rates rise, bond prices usually…", options: ["Rise", "Fall", "Stay same", "Double"] },
    { id: "fa_8", kind: "text", prompt: "Explain cash flow statement in 1–2 lines." },
    { id: "fa_9", kind: "mcq", prompt: "Which is a valuation multiple?", options: ["P/E", "Inventory turnover", "Days sales outstanding", "Net margin"] },
    { id: "fa_10", kind: "text", prompt: "What does ROI mean? (short)" },
    { id: "fa_11", kind: "text", prompt: "Name 2 risks you would check in a company analysis." },
    { id: "fa_12", kind: "text", prompt: "Define CAPEX vs OPEX in 2 short lines." },
  ],
  business_analyst: [
    { id: "ba_1", kind: "text", prompt: "What is the role of a Business Analyst? (one line)" },
    { id: "ba_2", kind: "mcq", prompt: "BRD stands for…", options: ["Business Requirement Document", "Backend Runtime Definition", "Business Risk Dashboard", "Baseline Release Design"] },
    { id: "ba_3", kind: "text", prompt: "What is a user story? (short)" },
    { id: "ba_4", kind: "mcq", prompt: "Which is commonly used for process modeling?", options: ["BPMN", "JWT", "REST", "TCP"] },
    { id: "ba_5", kind: "text", prompt: "What is scope creep? (short)" },
    { id: "ba_6", kind: "text", prompt: "Name 2 ways you gather requirements." },
    { id: "ba_7", kind: "mcq", prompt: "Acceptance criteria are used to…", options: ["Reject all features", "Define when a story is done", "Increase budget", "Replace QA"] },
    { id: "ba_8", kind: "text", prompt: "What is a wireframe? (short)" },
    { id: "ba_9", kind: "mcq", prompt: "Which is a prioritization method?", options: ["MoSCoW", "HTTP", "MVC", "SQL"] },
    { id: "ba_10", kind: "text", prompt: "Define KPI in one line." },
    { id: "ba_11", kind: "text", prompt: "What is UAT? (short)" },
    { id: "ba_12", kind: "text", prompt: "How do you handle conflicting requirements? (short)" },
  ],
  java_full_stack: [
    { id: "jfs_1", kind: "mcq", prompt: "Which is an HTTP method for updating a resource?", options: ["PUT", "TRACE", "PING", "ECHO"] },
    { id: "jfs_2", kind: "text", prompt: "What does REST mean? (short)" },
    { id: "jfs_3", kind: "mcq", prompt: "In Java, an interface is mainly used to…", options: ["Store data", "Define contracts/behaviors", "Replace classes completely", "Compile faster"] },
    { id: "jfs_4", kind: "text", prompt: "What is a primary key? (short)" },
    { id: "jfs_5", kind: "mcq", prompt: "Which is a common Java build tool?", options: ["Maven", "Nginx", "Docker", "Redis"] },
    { id: "jfs_6", kind: "text", prompt: "What is CORS? (short)" },
    { id: "jfs_7", kind: "mcq", prompt: "What does SQL JOIN do?", options: ["Deletes rows", "Combines rows from tables", "Encrypts data", "Creates UI"] },
    { id: "jfs_8", kind: "text", prompt: "Define API in one line." },
    { id: "jfs_9", kind: "mcq", prompt: "Which is front-end framework/library?", options: ["React", "JUnit", "Hibernate", "JDBC"] },
    { id: "jfs_10", kind: "text", prompt: "What is authentication vs authorization? (short)" },
    { id: "jfs_11", kind: "text", prompt: "What is an exception in Java? (short)" },
    { id: "jfs_12", kind: "text", prompt: "What does 'stateless' mean in HTTP? (short)" },
  ],
  python_full_stack: [
    { id: "pfs_1", kind: "mcq", prompt: "In Python, a dictionary is…", options: ["Ordered list", "Key-value mapping", "Binary tree", "Database table"] },
    { id: "pfs_2", kind: "text", prompt: "What is a virtual environment? (short)" },
    { id: "pfs_3", kind: "mcq", prompt: "Which is a Python web framework?", options: ["Django", "Gradle", "JUnit", "Kafka"] },
    { id: "pfs_4", kind: "text", prompt: "What is an API endpoint? (short)" },
    { id: "pfs_5", kind: "mcq", prompt: "SQL injection is prevented mainly by…", options: ["String concat", "Parameterized queries", "More RAM", "Bigger servers"] },
    { id: "pfs_6", kind: "text", prompt: "What is CORS? (short)" },
    { id: "pfs_7", kind: "mcq", prompt: "Which is a package manager for Python?", options: ["pip", "npm", "gem", "cargo"] },
    { id: "pfs_8", kind: "text", prompt: "What is a migration in databases? (short)" },
    { id: "pfs_9", kind: "mcq", prompt: "Which HTTP status means 'not found'?", options: ["404", "200", "201", "500"] },
    { id: "pfs_10", kind: "text", prompt: "What is authentication vs authorization? (short)" },
    { id: "pfs_11", kind: "text", prompt: "What does 'idempotent' mean for an API method? (short)" },
    { id: "pfs_12", kind: "text", prompt: "Explain cache in one line." },
  ],
};

export const CODING_PROBLEMS: Record<"python" | "java", CodingProblem[]> = {
  python: [
    { id: "py_1", difficulty: "easy", title: "Sum of even numbers", prompt: "Given a list of integers, return the sum of only the even numbers. Example: [1,2,3,4] => 6", hint: "Loop and add n where n % 2 == 0.", starterCode: { python: "def sum_even_numbers(numbers):\n    # write here\n    pass\n" } },
    { id: "py_2", difficulty: "medium", title: "Most frequent character", prompt: "Given a string, return the character that appears the most times. Ignore spaces. If tie, return any one. Example: 'aab c' => 'a'", hint: "Use a dictionary to count occurrences.", starterCode: { python: "def most_frequent_char(text):\n    # write here\n    pass\n" } },
    { id: "py_3", difficulty: "hard", title: "Merge overlapping intervals", prompt: "Given intervals like [[1,3],[2,6],[8,10]], merge overlaps. Example => [[1,6],[8,10]].", hint: "Sort by start, then merge into the last interval.", starterCode: { python: "def merge_intervals(intervals):\n    # write here\n    pass\n" } },
  ],
  java: [
    { id: "java_1", difficulty: "easy", title: "Sum of even numbers", prompt: "Given an int[] array, return the sum of only the even numbers. Example: [1,2,3,4] => 6", hint: "Loop and add n where n % 2 == 0.", starterCode: { java: "public static int sumEvenNumbers(int[] numbers) {\n    // write here\n    return 0;\n}\n" } },
    { id: "java_2", difficulty: "medium", title: "Most frequent character", prompt: "Given a String, return the character that appears the most times. Ignore spaces. If tie, return any one.", hint: "Use a HashMap<Character, Integer> to count occurrences.", starterCode: { java: "public static char mostFrequentChar(String text) {\n    // write here\n    return '\\0';\n}\n" } },
    { id: "java_3", difficulty: "hard", title: "Merge overlapping intervals", prompt: "Given intervals, merge overlaps. Example: [[1,3],[2,6],[8,10]] => [[1,6],[8,10]]. Use int[][].", hint: "Sort by start, then merge into the last interval.", starterCode: { java: "public static int[][] mergeIntervals(int[][] intervals) {\n    // write here\n    return new int[][]{};\n}\n" } },
  ],
};

export const VIDEO_QUESTIONS: string[] = [
  "In 60 seconds: describe your current situation and what you need most in the next 60 days.",
  "Why did you choose this domain? What are you genuinely best at in it?",
  "Be brutally honest: what are you worst at right now in your domain?",
  "Describe a time you were under pressure and how you handled it.",
  "If we give you a training plan, what will you do daily to finish it?",
];
