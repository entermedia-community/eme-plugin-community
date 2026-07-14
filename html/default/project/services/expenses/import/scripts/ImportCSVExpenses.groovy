import org.entermediadb.asset.importer.BaseImporter
import org.entermediadb.asset.util.Row
import org.openedit.data.*
import org.openedit.*
import org.openedit.data.*

class CsvImporter extends BaseImporter
{
	public String collectionid;
	
	public void addCustomProperties(Row inRow, Data inData)
	{
		inData.setValue("collectionid", collectionid);
	}

}

String collectionid = context.getRequestParameter("collectionid");

CsvImporter csvimporter = new CsvImporter();
csvimporter.setModuleManager(moduleManager);
csvimporter.setContext(context);
csvimporter.setLog(log);
csvimporter.setMakeId(false);

csvimporter.collectionid = collectionid;
csvimporter.addDbLookUpFilter("collectiveproject","parentcollectionid", collectionid);
csvimporter.importData();
