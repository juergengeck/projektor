# Amway Germany: research for the App Book

Researched 2026-09-13. Scope: public German-market product and business pages.
This is source evidence for product structure, not a compensation calculator or
a claim of an authorized Amway integration. Dynamic pages were read in the
browser because search extraction often returned only navigation.

## Observations and structural decisions

| Official observation | App Book decision |
| --- | --- |
| The storefront groups products into nutrition, beauty, personal care and home. | Add a product catalog chapter; categories organize products, not departments or permissions. |
| Earnings are presented as retail margin, Core Plan commissions and Core Plus incentives. | Add an earnings chapter separate from goods sales, receivables and cash. |
| Returns differ for direct purchasers, purchasers from a business partner and guest purchasers. | Record seller of record and purchase channel; route after-sales work from the original order. |
| Recurring orders can be created, changed or cancelled, with different benefits by customer/partner status. | Give subscriptions their own lifecycle; each executed occurrence has its own order identity. |
| The Amway Promise states there is no purchasing obligation for new business partners. | Keep manager-held inventory optional; do not make warehouse stock an onboarding requirement. |

Sources:

- [German storefront](https://www.amway.de/en/): category structure.
- [Personal care catalog](https://www.amway.de/en/Personal%20Care/c/10284): item identifiers, variants, set components and subscription labels; observed prices are not seeded as permanent prices.
- [Earn with Amway](https://www.amway.de/about-amway/earn-with-amway): public earnings overview. It advertises a 20% retail margin, monthly/annual Core Plan commissions related to individual/team performance, and additional Core Plus incentives. This is not the complete eligibility or calculation policy.
- [Returns](https://www.amway.de/secure-shopping/return-policy): original-order return process, return reference, tracking, inspection, refund/replacement, and complete-set requirements.
- [Recurring orders](https://www.amway.de/about-amway/amway-recurring-order): scheduling and cancellation, account-dependent benefits, and PW/GV terminology.
- [Amway Promise](https://www.amway.de/about-amway/amway-promise): customer/partner support, no purchase obligation and stock-buyback possibilities.

## Proposed domain structure

Keep three independent relationship dimensions: department membership and app
role; customer-to-selling-business relationship; and any externally evidenced
partner/team/sponsor relationship. The four requested app roles remain admin,
manager, seller and customer. They are not asserted to be Amway account types,
qualification ranks or employment titles. A team relationship never implicitly
grants another participant's phonebook, inventory, commissions or chat.

Orders distinguish direct Amway fulfilment from fulfilment using goods actually
held at a managed facility. The app's seller role does not establish the legal
seller. Direct orders cannot consume fictitious local stock. Conversely, a real
manager-owned lot keeps its owner, custodian, facility and acquisition evidence.

For performance reporting, retain the source's PW/PV and GV/BV terminology,
period, market and exact statement references. Do not convert points into euros
or assume that departmental totals are an eligible compensation team. A statement
can be reconciled with orders without reconstructing an unverified bonus plan.

## Unverified inputs

Current German compensation-plan formulas, eligibility thresholds, sponsor/team
data contracts and actual account/order/statement export interfaces were not
verified. Neither a public storefront nor a partner relationship proves API
access. Product-specific guarantee conditions and applicable contract versions
must be attached to real cases; no universal refund entitlement is inferred.

All operational consequences above are proposed application design. Keep them
under app-book-contract evidence until implemented and tested by the main task.
