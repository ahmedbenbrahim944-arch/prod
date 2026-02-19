import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OuvrierComponent } from './ouvrier.component';

describe('OuvrierComponent', () => {
  let component: OuvrierComponent;
  let fixture: ComponentFixture<OuvrierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OuvrierComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OuvrierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
