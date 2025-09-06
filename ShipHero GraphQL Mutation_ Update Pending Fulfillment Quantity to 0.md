# ShipHero GraphQL Mutation: Update Pending Fulfillment Quantity to 0

## Overview

Based on the ShipHero developer documentation and community discussions, updating the pending fulfillment quantity on an existing order requires using the `order_update_line_items` mutation. This mutation is specifically designed to modify line item properties, including quantities and fulfillment status.

## Key Findings

1. **Separate Mutation Required**: Line items cannot be updated through the standard `order_update` mutation. Attempting to include `line_items` in `order_update` will result in an "Unknown field" error.

2. **Dedicated Line Item Mutation**: ShipHero provides `order_update_line_items` specifically for modifying line item properties.

3. **Line Item Identification**: Each line item must be identified by its unique `id` (not the SKU or partner_line_item_id).

## Sample Mutation

```graphql
mutation {
  order_update_line_items(
    data: {
      order_id: "T3JkZXI6MTIzNDU2Nzg5MA==" # Replace with your order ID
      line_items: [
        {
          id: "TGluZUl0ZW06OTg3NjU0MzIx" # Replace with your line item ID
          quantity: 0 # Set the pending fulfillment quantity to 0
        }
      ]
    }
  ) {
    request_id
    complexity
    order {
      id
      order_number
      line_items(first: 10) {
        edges {
          node {
            id
            sku
            quantity
            quantity_pending_fulfillment
          }
        }
      }
    }
  }
}
```

## Required Parameters

- **order_id**: The unique identifier of the order (Base64 encoded)
- **line_items.id**: The unique identifier of the specific line item to update
- **line_items.quantity**: Set to 0 to clear pending fulfillment quantity

## Getting Line Item IDs

To get the line item IDs, first query the order:

```graphql
query {
  order(id: "T3JkZXI6MTIzNDU2Nzg5MA==") {
    id
    order_number
    line_items(first: 10) {
      edges {
        node {
          id
          sku
          quantity
          quantity_pending_fulfillment
        }
      }
    }
  }
}
```

## Important Notes

1. **Authentication**: Ensure you have valid GraphQL API access and refresh tokens
2. **API Endpoint**: Use `https://public-api.shiphero.com/graphql`
3. **Rate Limiting**: Be aware of ShipHero's throttling and quota limits
4. **3PL Accounts**: If using a 3PL account, include `customer_account_id` in your mutations

## Alternative Fields

The mutation also supports updating other line item properties:
- `partner_line_item_id`: External reference ID
- `price`: Line item price
- `fulfillment_status`: Status of the line item

## Error Handling

Common errors:
- "Unknown field" when trying to use `line_items` in `order_update`
- Invalid line item ID if the ID doesn't exist
- Permission errors if the order belongs to a different account

## References

- ShipHero Developer Documentation: https://developer.shiphero.com/
- Community Discussion: https://community.shiphero.com/t/removing-items-and-adjusting-item-quantities/795
- API Schema: https://developer.shiphero.com/schema/

