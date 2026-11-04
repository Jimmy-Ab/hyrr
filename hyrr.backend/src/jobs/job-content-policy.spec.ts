import { evaluateJobContent } from "./job-content-policy"

const describeText = (description: string) => evaluateJobContent({ title: "Job", description })

describe("evaluateJobContent", () => {
  describe("flags scam phrasing", () => {
    it.each([
      ["Applicants must pay a $50 registration fee before starting.", /fee or deposit/],
      ["A refundable deposit of $200 is required for the starter kit.", /fee or deposit/],
      ["Successful candidates will need to pay the training fee of 1500 birr.", /fee or deposit/],
      ["Make a small payment to secure your slot in the onboarding programme.", /fee or deposit/],
      ["You must send the processing fee via Western Union.", /Western Union/],
      ["Payment can be transferred through MoneyGram to our agent.", /Western Union/],
      ["Buy three Apple gift cards and email us the codes.", /gift card/],
      ["Candidates must deposit 100 USDT to our wallet to activate the account.", /cryptocurrency/],
      [
        "You will receive a cheque; deposit the check and send the remaining balance to our vendor.",
        /cheque/,
      ],
      ["Contact our HR manager on Telegram only.", /WhatsApp\/Telegram/],
      ["Reach us via WhatsApp only, at +1 555 0100.", /WhatsApp\/Telegram/],
      ["Please send your bank account details before the interview.", /bank details/],
      ["Provide a passport copy with your application to be considered.", /bank details/],
      ["Share your SSN up front so we can run payroll checks.", /bank details/],
      ["Email us your online banking password for salary setup.", /passwords or PINs/],
    ])("%s", (text, reason) => {
      const reasons = describeText(text)
      expect(reasons.some((r) => reason.test(r))).toBe(true)
    })

    it("checks requirements and the title too", () => {
      expect(
        evaluateJobContent({
          title: "Data entry",
          description: "Work from home.",
          requirements: ["Applicants must pay an onboarding fee of $35"],
        })
      ).toHaveLength(1)
    })

    it("reports each reason once", () => {
      const reasons = describeText(
        "Applicants must pay a $50 registration fee. A $20 training fee is also required."
      )
      expect(reasons).toHaveLength(1)
    })
  })

  describe("accepts legitimate postings", () => {
    it.each([
      "We offer a competitive salary, equity and a generous training budget.",
      "We pay relocation and visa fees for successful candidates.",
      "There is no application fee. We never ask candidates for money.",
      "Telegram bot developer: build and maintain bots for our customer-support team.",
      "Experience integrating the WhatsApp Business API and Signal protocol is a plus.",
      "You must pay attention to detail and enjoy working with payment systems.",
      "Process tuition fee payments and reconcile student accounts; must have 2 years experience.",
      "Handle registration fee collection at the front desk and issue receipts.",
      "Build wallets that let users send and receive Bitcoin securely.",
      "We pay salaries in USDT or local currency, your choice.",
      "Applicants must hold a valid passport; please send your CV and portfolio.",
      "Payroll specialist: maintain employee bank details and process monthly payroll.",
      "Collect security deposits from tenants and coordinate move-ins.",
      "Training costs are covered by the company. Equipment is provided.",
      "Starting salary $4,500/month plus a $500 equipment stipend.",
      "Sell and redeem gift cards at the register; handle cash and card payments.",
      "Western Union is hiring a senior backend engineer for its payments platform.",
      "Bank teller: deposit cheques, cash checks and assist customers with transfers.",
      "Interview process: a 30 minute call, a take-home task and a final on-site interview.",
    ])("%s", (text) => {
      expect(describeText(text)).toEqual([])
    })

    it("handles empty content", () => {
      expect(evaluateJobContent({})).toEqual([])
    })
  })
})
