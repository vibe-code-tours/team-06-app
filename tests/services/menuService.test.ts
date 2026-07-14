import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import { createServiceClient } from '../helpers/supabaseTestClient'
import {
    createCategory,
    updateCategory,
    deleteCategory,
    createMenuItem,
    deleteMenuItem,
} from '../../apps/web/lib/services/menuService'

describe('menuService', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient))

    // =========================================================================
    // CATEGORY TESTS
    // =========================================================================

    describe('createCategory', () => {
        it('creates a category and returns its id', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await createCategory(serviceClient, fixture.restaurantId, {
                name: 'Desserts',
                sort_order: 1,
                is_active: true,
            })

            expect(result).toHaveProperty('id')
            if ('id' in result) {
                expect(result.id).toBeDefined()
            }
        })

        it('creates a category with default values', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await createCategory(serviceClient, fixture.restaurantId, {
                name: 'Drinks',
                sort_order: 0,
                is_active: true,
            })

            expect(result).toHaveProperty('id')
        })
    })

    describe('updateCategory', () => {
        it('updates a category name', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await updateCategory(serviceClient, fixture.categoryId, {
                name: 'Updated Mains',
            })

            expect(result).toEqual({ success: true })

            const { data } = await serviceClient
                .from('categories')
                .select('name')
                .eq('id', fixture.categoryId)
                .single()
            expect(data!.name).toBe('Updated Mains')
        })

        it('updates sort_order for reordering', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await updateCategory(serviceClient, fixture.categoryId, {
                sort_order: 5,
            })

            expect(result).toEqual({ success: true })

            const { data } = await serviceClient
                .from('categories')
                .select('sort_order')
                .eq('id', fixture.categoryId)
                .single()
            expect(data!.sort_order).toBe(5)
        })

        it('updates is_active status', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await updateCategory(serviceClient, fixture.categoryId, {
                is_active: false,
            })

            expect(result).toEqual({ success: true })

            const { data } = await serviceClient
                .from('categories')
                .select('is_active')
                .eq('id', fixture.categoryId)
                .single()
            expect(data!.is_active).toBe(false)
        })
    })

    describe('deleteCategory', () => {
        it('deletes an empty category', async () => {
            const fixture = await seedTestData(serviceClient)

            // Create a separate category without items
            const { data: newCat } = await serviceClient
                .from('categories')
                .insert({ restaurant_id: fixture.restaurantId, name: 'To Delete', sort_order: 99 })
                .select('id')
                .single()

            const result = await deleteCategory(serviceClient, newCat!.id)
            expect(result).toEqual({ success: true })

            const { data } = await serviceClient
                .from('categories')
                .select('id')
                .eq('id', newCat!.id)
                .single()
            expect(data).toBeNull()
        })
    })

    // =========================================================================
    // MENU ITEM TESTS
    // =========================================================================

    describe('createMenuItem', () => {
        it('creates a menu item with valid category', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await createMenuItem(serviceClient, fixture.restaurantId, {
                name: 'Fries',
                description: '',
                price: 5.99,
                category_id: fixture.categoryId,
                sort_order: 0,
                is_available: true,
            })

            expect(result).toHaveProperty('id')
            if ('id' in result) {
                expect(result.id).toBeDefined()
            }
        })

        it('rejects item if category belongs to a different restaurant', async () => {
            const fixture1 = await seedTestData(serviceClient)
            const fixture2 = await seedTestData(serviceClient)

            const result = await createMenuItem(serviceClient, fixture1.restaurantId, {
                name: 'Cross Tenant Item',
                description: '',
                price: 10,
                category_id: fixture2.categoryId,
                sort_order: 0,
                is_available: true,
            })

            expect(result).toHaveProperty('error')
            if ('error' in result) {
                expect(result.error).toContain('Category does not belong')
            }
        })
    })

    describe('deleteMenuItem', () => {
        it('deletes an item that has not been ordered', async () => {
            const fixture = await seedTestData(serviceClient)

            const result = await deleteMenuItem(serviceClient, fixture.menuItemId)
            expect(result).toEqual({ success: true })

            const { data } = await serviceClient
                .from('menu_items')
                .select('id')
                .eq('id', fixture.menuItemId)
                .single()
            expect(data).toBeNull()
        })

        it('returns error when deleting an item that has been ordered (FK RESTRICT)', async () => {
            const fixture = await seedTestData(serviceClient)

            // Create an order with the menu item
            await serviceClient.rpc('create_order_with_session', {
                p_restaurant_id: fixture.restaurantId,
                p_table_id: fixture.tableId,
                p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
            })

            const result = await deleteMenuItem(serviceClient, fixture.menuItemId)
            expect(result).toHaveProperty('error')
        })
    })
})
