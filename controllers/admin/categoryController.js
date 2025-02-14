const Category = require('../../models/categorySchema');

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        

        res.render('admin/category', {
            categories: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.error('error while loading category info', error);
        res.redirect('/pageError');
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;

    console.log('cname', name);
    console.log('des', description);
    
    
    try {
        const categoryName = name
        const existingCategory = await Category.findOne({  categoryName });
        if (existingCategory) {
            return res.status(500).send({ message: 'Category already exists' });
        }

        const newCategory = new Category({
            name,
            description
        });

        console.log(newCategory);
        

        await newCategory.save();

        return res.status(201).json({ message: 'Category added successfully' });
    } catch (error) {
        console.error('Error saving category:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }

};


const getEditCategory = async (req, res) => {
    try {
        
        const id = req.query.id
        const category = await Category.findOne({_id: id})
        res.render('admin/edit-category', {category: category})
        // res.send('helloo')

    } catch (error) {
        
        res.redirect('/pageError')
    }
}


const editCategory = async (req, res) => {
    try {

        const id = req.params.id
        const {categoryname, description} = req.body
        
        const existingCategory = await Category.findOne({name: categoryname})

        const updateCategory = await Category.updateOne({_id: id}, {$set: {
            name: categoryname,
            description: description
        }})

        if (updateCategory) {
            res.redirect('/admin/category')
        } else {
            res.status(404).json({error: 'Category not found!'})
        }


    } catch (error) {
        console.log('error happened', error);
        
        res.status(500).json({error: 'Internal Server error'})
    }
}

const getListCategory = async (req, res) => {
    try {

        let id = req.query.id
        await Category.findByIdAndUpdate(id, {isListed: true})
        
        // await Category.updateOne({_id: id}, {$set: {isListed: false}})
        res.redirect('/admin/category')


    } catch (error) {
        console.log('error happened ', error);
        
        res.redirect('/pageError')
    }
    
}

const getUnListCategory = async (req, res) => {
    try {

        let id = req.query.id
        
        // await Category.updateOne({_id: id}, {$set: {isListed: true}})
        const category =  await Category.find({_id: id}, {name: true})
        await Category.findByIdAndUpdate(id, {isListed: false})
        
        res.redirect('/admin/category')
    } catch (error) {
        res.redirect('/pageError')
    }
    
}




module.exports = {
    categoryInfo,
    addCategory,
    getEditCategory,
    editCategory,
    getListCategory,
    getUnListCategory
};
