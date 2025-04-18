const Category = require('../../models/categorySchema');
const HTTP_STATUS = require('../../utils/httpStatusCodes');
const CATEGORY_MESSAGES = require('../../utils/categoryMessages');
const Product = require('../../models/productSchema');

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
    try {
        // Check for an existing category with a case-sensitive match
        const existingCategory = await Category.findOne({ name: name }).collation({ locale: 'en', strength: 2 });
        if (existingCategory) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: CATEGORY_MESSAGES.CATEGORY_ALREADY_EXISTS });
        }

        const newCategory = new Category({
            name,
            description
        });

        await newCategory.save();
        return res.status(HTTP_STATUS.CREATED).json({ message: CATEGORY_MESSAGES.CATEGORY_ADDED_SUCCESSFULLY });
    } catch (error) {
        console.error('Error saving category:', error);
        let errorMessage = error.message;
        // Reformat the validation error message for description
        if (error.name === 'ValidationError' && error.errors && error.errors.description) {
            errorMessage = CATEGORY_MESSAGES.VALIDATION_DESCRIPTION_REQUIRED;
        }
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: errorMessage });
    }
};



const getEditCategory = async (req, res) => {
    try {
        
        const id = req.query.id
        const category = await Category.findOne({_id: id})
        res.render('admin/edit-category', {category: category})

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
            res.status(HTTP_STATUS.NOT_FOUND).json({ error: CATEGORY_MESSAGES.CATEGORY_NOT_FOUND });
        }

    } catch (error) {
        console.log('error happened', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: CATEGORY_MESSAGES.INTERNAL_SERVER_ERROR });
    }
}


const getListCategory = async (req, res) => {
    try {

        let id = req.query.id
        await Category.findByIdAndUpdate(id, {isListed: true})
        
        res.redirect('/admin/category')


    } catch (error) {
        console.log('error happened ', error);
        
        res.redirect('/pageError')
    }
    
}

const getUnListCategory = async (req, res) => {
    try {

        let id = req.query.id
        
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
